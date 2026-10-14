/**
 * The agent loop: send conversation to the LLM, execute any requested tools
 * (validated with the shared Zod schemas + the confirmation guard), feed the
 * results back, and repeat until the model produces a final text reply.
 */
import { zodErrorText } from "@/lib/zod-text";
import { AGENT_SYSTEM_PROMPT } from "./system-prompt";
import { CONFIRMATION_REQUIRED_MESSAGE, hasExplicitConfirmation } from "./guard";
import { GUARD_ERROR_CODE, TOOL_DEFINITIONS, TOOL_DEFINITIONS_BY_NAME } from "./tool-definitions";
import type {
  AgentMessage,
  AgentRunResult,
  LlmProvider,
  ProviderMessage,
  ToolActivityItem,
  ToolContext,
  ToolHandlers,
} from "./types";

const MAX_ITERATIONS = 6;

export interface RunAgentOptions {
  messages: AgentMessage[];
  provider: LlmProvider;
  handlers: ToolHandlers;
  maxIterations?: number;
  systemPrompt?: string;
}

export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  const {
    messages,
    provider,
    handlers,
    maxIterations = MAX_ITERATIONS,
    systemPrompt = AGENT_SYSTEM_PROMPT,
  } = options;

  const providerMessages: ProviderMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const toolActivity: ToolActivityItem[] = [];
  const ctx: ToolContext = { conversation: messages };

  let lastText = "";

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const turn = await provider.sendTurn(providerMessages, systemPrompt);
    lastText = turn.text || lastText;

    if (turn.toolCalls.length === 0) {
      return { reply: turn.text, toolActivity };
    }

    providerMessages.push({ role: "assistant", content: turn.text, toolCalls: turn.toolCalls });

    for (const call of turn.toolCalls) {
      const definition = TOOL_DEFINITIONS_BY_NAME.get(call.name);

      // Unknown tool — tell the model it does not exist.
      if (!definition) {
        providerMessages.push({
          role: "tool", callId: call.id, name: call.name, isError: true,
          content: JSON.stringify({ error: { code: "UNKNOWN_TOOL", message: `Tool "${call.name}" does not exist.` } }),
        });
        toolActivity.push({ tool: call.name, label: "Unknown tool", status: "error" });
        continue;
      }

      // 1. Validate the model's arguments with the SAME Zod schemas as the API.
      if (definition.argSchema) {
        const parsed = definition.argSchema.safeParse(call.input);
        if (!parsed.success) {
          const details = zodErrorText(parsed.error);
          providerMessages.push({
            role: "tool", callId: call.id, name: call.name, isError: true,
            content: JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "Tool arguments failed validation. Ask the customer to correct these details.", details } }),
          });
          toolActivity.push({ tool: call.name, label: definition.label, status: "error", detail: "Invalid details — correction requested" });
          continue;
        }
      }

      // 2. Deterministic confirmation guard for submissions.
      if (call.name === "submit_application" && !hasExplicitConfirmation(ctx.conversation)) {
        providerMessages.push({
          role: "tool", callId: call.id, name: call.name, isError: true,
          content: JSON.stringify({ error: { code: GUARD_ERROR_CODE, message: CONFIRMATION_REQUIRED_MESSAGE } }),
        });
        toolActivity.push({ tool: call.name, label: definition.label, status: "error", detail: "Blocked — customer confirmation required" });
        continue;
      }

      // 3. Execute against the real backend API (never simulated).
      const handler = handlers[call.name];
      if (!handler) {
        providerMessages.push({
          role: "tool", callId: call.id, name: call.name, isError: true,
          content: JSON.stringify({ error: { code: "TOOL_UNAVAILABLE", message: "This action is temporarily unavailable." } }),
        });
        toolActivity.push({ tool: call.name, label: definition.label, status: "error", detail: "Unavailable" });
        continue;
      }

      try {
        const result = await handler(call.input, ctx);
        providerMessages.push({
          role: "tool", callId: call.id, name: call.name, content: result.content, isError: result.isError,
        });
        toolActivity.push({
          tool: call.name,
          label: definition.label,
          status: result.isError ? "error" : "ok",
          detail: result.detail,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        providerMessages.push({
          role: "tool", callId: call.id, name: call.name, isError: true,
          content: JSON.stringify({ error: { code: "TOOL_ERROR", message: "The request could not be completed. Please try again." } }),
        });
        toolActivity.push({ tool: call.name, label: definition.label, status: "error", detail: message.slice(0, 80) });
      }
    }
  }

  return {
    reply:
      lastText ||
      "I apologise, but I could not complete that request just now. Please try again in a moment.",
    toolActivity,
  };
}

export { TOOL_DEFINITIONS };
