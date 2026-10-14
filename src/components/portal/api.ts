/**
 * Thin browser API client. The browser NEVER computes financial values —
 * it only sends raw inputs and renders server-computed results.
 */
import type {
  ChatMessage,
  LeadCreatedResponse,
  LeadListItem,
  QuoteResponse,
  SchemeDto,
  ToolActivityItem,
} from "./types";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body?.error ?? {};
    throw new ApiClientError(
      res.status,
      error.code ?? "UNEXPECTED_ERROR",
      error.message ?? "Something went wrong. Please try again.",
      error.details,
    );
  }
  return body as T;
}

export function fetchSchemes(signal?: AbortSignal): Promise<{ schemes: SchemeDto[] }> {
  return request("/api/v1/loan-schemes", { signal });
}

export function fetchQuote(
  input: { grossWeightGrams: number; netWeightGrams: number; karat: number },
  signal?: AbortSignal,
): Promise<QuoteResponse> {
  return request("/api/v1/quotes", { method: "POST", body: JSON.stringify(input), signal });
}

export function submitLead(input: {
  applicantName: string;
  mobile: string;
  grossWeightGrams: number;
  netWeightGrams: number;
  karat: number;
  planId: string;
}): Promise<LeadCreatedResponse> {
  return request("/api/v1/leads", { method: "POST", body: JSON.stringify(input) });
}

export function fetchLeads(
  planId?: string,
  signal?: AbortSignal,
): Promise<{ count: number; leads: LeadListItem[] }> {
  const query = planId ? `?plan=${encodeURIComponent(planId)}` : "";
  return request(`/api/v1/leads${query}`, { signal });
}

export function chatAvailability(): Promise<{ available: boolean; provider: string | null; model: string | null }> {
  return request("/api/v1/chat");
}

export function chatSend(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ reply: string; toolActivity: ToolActivityItem[] }> {
  return request("/api/v1/chat", { method: "POST", body: JSON.stringify({ messages }) });
}

export type { ChatMessage };
