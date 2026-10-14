"use client";

import clsx from "clsx";
import {
  AlertCircle,
  Bot,
  Calculator,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  ListChecks,
  Loader2,
  SendHorizonal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiClientError, chatAvailability, chatSend } from "./api";
import type { ChatMessage, ToolActivityItem } from "./types";

const TOOL_ICONS: Record<string, React.ReactNode> = {
  get_loan_schemes: <ListChecks className="h-3 w-3" aria-hidden />,
  calculate_quote: <Calculator className="h-3 w-3" aria-hidden />,
  submit_application: <FileCheck2 className="h-3 w-3" aria-hidden />,
};

const SUGGESTIONS = [
  "What gold loan plans do you offer?",
  "I have 45 g of 22K gold — how much can I get?",
  "Help me apply for a gold loan",
];

function ToolChip({ item }: { item: ToolActivityItem }) {
  const ok = item.status === "ok";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        ok ? "border-gold/40 bg-gold-tint/60 text-gold-deep" : "border-danger/30 bg-danger-tint text-danger",
      )}
    >
      {ok ? TOOL_ICONS[item.tool] ?? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <AlertCircle className="h-3 w-3" aria-hidden />}
      {item.label}
      {item.detail && <span className={clsx("font-normal", ok ? "text-gold-deep/80" : "text-danger/80")}>· {item.detail}</span>}
    </span>
  );
}

export function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [availability, setAvailability] = useState<{ available: boolean; provider: string | null } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    chatAvailability()
      .then(setAvailability)
      .catch(() => setAvailability({ available: false, provider: null }));
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const history = next.map(({ role, content }) => ({ role, content }));
      const result = await chatSend(history);
      setMessages([
        ...next,
        { role: "assistant", content: result.reply, activity: result.toolActivity },
      ]);
    } catch (error) {
      const message =
        error instanceof ApiClientError && error.code === "LLM_NOT_CONFIGURED"
          ? "The assistant is not configured on this deployment. You can still complete your application using the form."
          : "The assistant couldn't respond just now. Please try again, or use the application form.";
      setMessages([...next, { role: "assistant", content: message }]);
      if (error instanceof ApiClientError && error.code === "LLM_NOT_CONFIGURED") {
        setAvailability({ available: false, provider: null });
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="AI loan assistant">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-paper shadow-raised">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-gold-deep text-white">
              <Bot className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-[15px] font-semibold leading-tight">Loan Assistant</p>
              <p className="text-[11px] text-ink-3">
                {availability === null
                  ? "Checking availability…"
                  : availability.available
                    ? "Online · answers use live plan data"
                    : "Not configured on this deployment"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant"
            className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="grid gap-3">
              <div className="max-w-[85%] rounded-xl rounded-tl-sm border border-line bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
                Namaste. I can explain our gold loan plans, calculate your indicative quote, and
                submit an application after your confirmation. How can I help?
              </div>
              {availability?.available && (
                <div className="mt-2 grid gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">Try asking</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-lg border border-line-2 bg-surface px-3 py-2 text-left text-[12.5px] font-medium text-ink-2 transition-colors hover:border-gold/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {availability?.available === false && messages.length === 0 && (
            <div className="mt-3 rounded-xl border border-line bg-surface p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <KeyRound className="h-4 w-4 text-gold-deep" aria-hidden />
                Enable the AI assistant
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
                The assistant uses Google Gemini. Add your API key to your{" "}
                <code className="rounded bg-paper px-1 py-0.5 font-mono text-[11.5px]">.env</code> and restart:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-ink px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-paper">
{`LLM_PROVIDER=google
GOOGLE_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-flash`}
              </pre>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
                Keys stay securely on the server and are never exposed to the client. The application form
                and admin dashboard work fully without the assistant.
              </p>
            </div>
          )}

          <ol className="mt-2 grid gap-3">
            {messages.map((message, index) => (
              <li key={index} className={clsx("grid gap-1.5", message.role === "user" && "justify-items-end")}>
                <div
                  className={clsx(
                    "max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap",
                    message.role === "user"
                      ? "rounded-br-sm bg-gold-deep text-white"
                      : "rounded-tl-sm border border-line bg-surface text-ink",
                  )}
                >
                  {message.content}
                </div>
                {message.activity && message.activity.length > 0 && (
                  <div className="flex max-w-[85%] flex-wrap gap-1.5" aria-label="Assistant actions">
                    {message.activity.map((item, i) => (
                      <ToolChip key={i} item={item} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>

          {sending && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl rounded-tl-sm border border-line bg-surface px-3.5 py-2.5 text-[13px] text-ink-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" aria-hidden />
              Working on it…
            </div>
          )}
        </div>

        <form
          className="border-t border-line bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="flex items-center gap-2">
            <label htmlFor="assistant-input" className="sr-only">
              Message the loan assistant
            </label>
            <input
              id="assistant-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 1000))}
              placeholder={availability?.available === false ? "Enable the assistant to chat…" : "Type your question…"}
              disabled={availability?.available === false}
              className="h-10 flex-1 rounded-lg border border-line-2 bg-white px-3 text-[13.5px] text-ink placeholder:text-ink-3/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || availability?.available === false}
              aria-label="Send message"
              className="grid h-10 w-10 place-items-center rounded-lg bg-gold-deep text-white transition-colors hover:bg-[#5d481a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-50"
            >
              <SendHorizonal className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-ink-3">
            The assistant never calculates amounts itself — every figure comes from the same secure
            APIs as the form. Submission always needs your explicit confirmation.
          </p>
        </form>
      </aside>
    </div>
  );
}
