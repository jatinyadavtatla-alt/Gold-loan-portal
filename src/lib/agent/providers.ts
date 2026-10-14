/**
 * LLM provider adapters for the AI Loan Assistant.
 *
 * Configured via environment variables (server-side only, never NEXT_PUBLIC):
 *   LLM_PROVIDER = google (default)
 *   GOOGLE_API_KEY = ...
 *   GEMINI_MODEL = gemini-2.5-flash (default)
 *
 * If no key is configured, getProviderFromEnv() returns null and the chat
 * endpoint returns LLM_NOT_CONFIGURED. The portal remains fully functional.
 */
import { GoogleGenAI } from "@google/genai";
import { TOOL_DEFINITIONS } from "./tool-definitions";
import type { LlmProvider, ProviderMessage, ProviderTurn, ToolCall } from "./types";
import { ProviderError } from "./types";

const REQUEST_TIMEOUT_MS = 45_000;

/* ---------------------------------- Google Gemini ---------------------------------- */

function toGeminiContents(messages: ProviderMessage[]) {
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

  for (const message of messages) {
    if (message.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: message.content }],
      });
    } else if (message.role === "assistant") {
      const parts: Array<Record<string, unknown>> = [];
      if (message.content && message.content.trim().length > 0) {
        parts.push({ text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        if (call.rawPart) {
          parts.push(call.rawPart);
        } else {
          parts.push({
            functionCall: {
              name: call.name,
              args: call.input ?? {},
              id: call.id,
            },
            ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
          });
        }
      }
      if (parts.length === 0) {
        parts.push({ text: " " });
      }
      contents.push({ role: "model", parts });
    } else if (message.role === "tool") {
      let responseObj: Record<string, unknown>;
      try {
        responseObj = JSON.parse(message.content);
      } catch {
        responseObj = { output: message.content };
      }
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: message.name,
              response: responseObj,
            },
          },
        ],
      });
    }
  }

  return contents;
}

export function createGeminiProvider(apiKey: string, model: string = "gemini-3.7-flash"): LlmProvider {
  const ai = new GoogleGenAI({ apiKey });
  const candidateModels = [model, "gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"]
    .filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);

  return {
    id: "google",
    model,
    async sendTurn(messages, system) {
      const contents = toGeminiContents(messages);
      const functionDeclarations = TOOL_DEFINITIONS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));

      let lastError: unknown = null;
      for (const candidate of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: candidate,
              contents,
              config: {
                systemInstruction: system,
                tools: [{ functionDeclarations }],
              },
            });

            const text = response.text ?? "";
            const rawParts = response.candidates?.[0]?.content?.parts ?? [];
            const toolCalls: ToolCall[] = [];
            for (let index = 0; index < rawParts.length; index++) {
              const part = rawParts[index] as {
                functionCall?: { name?: string; args?: Record<string, unknown>; id?: string };
                thoughtSignature?: string;
              };
              if (part?.functionCall) {
                toolCalls.push({
                  id: part.functionCall.id || `call_${Date.now()}_${index}`,
                  name: part.functionCall.name || "unknown",
                  input: (part.functionCall.args as Record<string, unknown>) ?? {},
                  thoughtSignature: part.thoughtSignature,
                  rawPart: part as unknown as Record<string, unknown>,
                });
              }
            }

            return { text: text.trim(), toolCalls } satisfies ProviderTurn;
          } catch (error) {
            lastError = error;
            const status = (error as { status?: number }).status;
            if ((status === 503 || status === 429) && attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            if (status === 404 || status === 503) {
              break; // Try next candidate model
            }
            break;
          }
        }
      }

      const status = (lastError as { status?: number })?.status ?? 502;
      const msg = lastError instanceof Error ? lastError.message : String(lastError);
      throw new ProviderError(`Google Gemini request failed: ${msg}`, status);
    },
  };
}

/* ---------------------------------- Anthropic (Auxiliary) ------------------------- */

function toAnthropicMessages(messages: ProviderMessage[]) {
  const out: Array<Record<string, unknown>> = [];
  for (const message of messages) {
    if (message.role === "user") {
      out.push({ role: "user", content: [{ type: "text", text: message.content }] });
    } else if (message.role === "assistant") {
      const content: Array<Record<string, unknown>> = [];
      if (message.content) content.push({ type: "text", text: message.content });
      for (const call of message.toolCalls ?? []) {
        content.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
      }
      out.push({ role: "assistant", content: content.length ? content : [{ type: "text", text: " " }] });
    } else {
      const block = {
        type: "tool_result",
        tool_use_id: message.callId,
        content: message.content,
        ...(message.isError ? { is_error: true } : {}),
      };
      const last = out[out.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content) && last.__toolResults) {
        (last.content as unknown[]).push(block);
      } else {
        out.push({ role: "user", content: [block], __toolResults: true });
      }
    }
  }
  return out.map(({ __toolResults: _ignored, ...rest }) => rest);
}

export function createAnthropicProvider(apiKey: string, model: string): LlmProvider {
  return {
    id: "anthropic",
    model,
    async sendTurn(messages, system) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system,
          tools: TOOL_DEFINITIONS.map((d) => ({
            name: d.name,
            description: d.description,
            input_schema: d.parameters,
          })),
          messages: toAnthropicMessages(messages),
        }),
      });
      if (!res.ok) throw await toProviderError(res, "Anthropic");

      const data = (await res.json()) as {
        content?: Array<
          | { type: "text"; text: string }
          | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
        >;
      };
      const text = (data.content ?? [])
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const toolCalls: ToolCall[] = (data.content ?? [])
        .filter((b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => b.type === "tool_use")
        .map((b) => ({ id: b.id, name: b.name, input: b.input ?? {} }));
      return { text, toolCalls } satisfies ProviderTurn;
    },
  };
}

/* ----------------------------------- OpenAI (Auxiliary) -------------------------- */

function toOpenAIMessages(messages: ProviderMessage[], system: string) {
  const out: Array<Record<string, unknown>> = [{ role: "system", content: system }];
  for (const message of messages) {
    if (message.role === "user") {
      out.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      out.push({
        role: "assistant",
        content: message.content || null,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: JSON.stringify(call.input) },
              })),
            }
          : {}),
      });
    } else {
      out.push({ role: "tool", tool_call_id: message.callId, content: message.content });
    }
  }
  return out;
}

export function createOpenAIProvider(apiKey: string, model: string): LlmProvider {
  return {
    id: "openai",
    model,
    async sendTurn(messages, system) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: toOpenAIMessages(messages, system),
          tools: TOOL_DEFINITIONS.map((d) => ({
            type: "function",
            function: { name: d.name, description: d.description, parameters: d.parameters },
          })),
          tool_choice: "auto",
        }),
      });
      if (!res.ok) throw await toProviderError(res, "OpenAI");

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>;
          };
        }>;
      };
      const message = data.choices?.[0]?.message;
      const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((call, index) => {
        let input: Record<string, unknown> = {};
        try {
          input = call.function?.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
        } catch {
          input = {};
        }
        return { id: call.id ?? `call_${index}`, name: call.function?.name ?? "unknown", input };
      });
      return { text: (message?.content ?? "").trim(), toolCalls } satisfies ProviderTurn;
    },
  };
}

/* ---------------------------------- Factory ------------------------------------ */

async function toProviderError(res: Response, vendor: string): Promise<ProviderError> {
  let snippet = "";
  try {
    snippet = (await res.text()).slice(0, 200);
  } catch {
    /* ignore */
  }
  return new ProviderError(`${vendor} request failed (${res.status})${snippet ? `: ${snippet}` : ""}`, res.status);
}

export function getProviderFromEnv(): LlmProvider | null {
  const provider = (process.env.LLM_PROVIDER || "google").toLowerCase();
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.7-flash";

  // When google is selected (default), check for GOOGLE_API_KEY
  if (provider === "google") {
    if (!googleApiKey || googleApiKey.trim().length === 0) {
      return null;
    }
    return createGeminiProvider(googleApiKey, geminiModel);
  }

  // Explicit opt-in to Anthropic or OpenAI if specified
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (provider === "anthropic" && anthropicKey) {
    return createAnthropicProvider(anthropicKey, process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5");
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (provider === "openai" && openaiKey) {
    return createOpenAIProvider(openaiKey, process.env.OPENAI_MODEL || "gpt-4o-mini");
  }

  // Fallback: if GOOGLE_API_KEY is present
  if (googleApiKey && googleApiKey.trim().length > 0) {
    return createGeminiProvider(googleApiKey, geminiModel);
  }

  return null;
}
