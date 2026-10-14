/**
 * Confirmation guard — a deterministic, model-independent safety net.
 *
 * Even if an LLM is prompt-injected into calling submit_application, the
 * agent loop refuses to execute the tool unless the USER-VISIBLE conversation
 * shows: (1) an assistant message that asked for confirmation, immediately
 * followed by (2) an affirmative user reply as the latest user message.
 */
import type { AgentMessage } from "./types";

const CONFIRM_PROMPT =
  /(confirm|shall i (submit|proceed)|do you (want|wish) me to (submit|proceed)|is everything (correct|accurate)|please review|review (and|then) confirm)/i;

const AFFIRMATIVE =
  /^\s*(yes|yeah|yep|yup|ok|okay|sure|confirm|confirmed|proceed|submit|go ahead|looks good|that'?s correct|that is correct|correct|right|perfect|fine|haan|ha|theek hai|sahi hai)\b/i;

/** A "yes" that is really a new instruction ("yes, but change my mobile") is NOT consent. */
const NEGATING = /\b(but|however|wait|change|except|instead|actually|don'?t|do\s+not|hold\s+on)\b/i;

function isAffirmativeReply(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false; // long replies carry new instructions
  if (!AFFIRMATIVE.test(trimmed)) return false;
  if (NEGATING.test(trimmed)) return false;
  return true;
}

export const CONFIRMATION_REQUIRED_MESSAGE =
  "Submission blocked: the customer has not explicitly confirmed the full application summary. Show the complete summary (name, mobile, weights, karat, plan, eligible loan) and ask for explicit confirmation first. Only call this tool again after the customer replies with a clear yes.";

/** Does the conversation end with an affirmative user reply to a confirmation request? */
export function hasExplicitConfirmation(conversation: AgentMessage[]): boolean {
  let lastUserIdx = -1;
  for (let i = conversation.length - 1; i >= 0; i -= 1) {
    if (conversation[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return false;
  if (!isAffirmativeReply(conversation[lastUserIdx].content)) return false;

  for (let i = lastUserIdx - 1; i >= 0; i -= 1) {
    const message = conversation[i];
    if (message.role === "user") return false; // a newer question turns old confirm stale
    if (message.role === "assistant" && CONFIRM_PROMPT.test(message.content)) {
      return true;
    }
  }
  return false;
}
