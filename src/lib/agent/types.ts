/**
 * Provider-agnostic agent types. The conversational IR below is translated
 * into Anthropic or OpenAI wire formats by the adapters in providers.ts.
 */

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  thoughtSignature?: string;
  rawPart?: Record<string, unknown>;
}

/** Internal representation handed to / returned from providers. */
export type ProviderMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; callId: string; name: string; content: string; isError?: boolean };

export interface ProviderTurn {
  text: string;
  toolCalls: ToolCall[];
}

export interface LlmProvider {
  id: "google" | "anthropic" | "openai" | "scripted";
  model: string;
  sendTurn(messages: ProviderMessage[], system: string): Promise<ProviderTurn>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** What a tool handler produces. `content` is JSON text fed back to the model. */
export interface ToolHandlerResult {
  content: string;
  isError?: boolean;
  /** Short human-readable detail for the chat UI (no PII). */
  detail?: string;
}

export interface ToolContext {
  /** The user-visible conversation; used by the submission-confirmation guard. */
  conversation: AgentMessage[];
}

export type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolHandlerResult>;

export type ToolHandlers = Record<string, ToolHandler>;

export interface ToolActivityItem {
  tool: string;
  label: string;
  status: "ok" | "error";
  detail?: string;
}

export interface AgentRunResult {
  reply: string;
  toolActivity: ToolActivityItem[];
}
