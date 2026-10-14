/**
 * Agent-loop tests. These use a scripted LlmProvider (no live LLM needed in
 * CI) plus handlers that call the REAL route handlers in-process — so the
 * tests verify the exact validation/finance path used in production, and
 * that no submission can happen without explicit user confirmation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postLeads } from "@/app/api/v1/leads/route";
import { POST as postQuote } from "@/app/api/v1/quotes/route";
import { GET as getSchemes } from "@/app/api/v1/loan-schemes/route";
import { ensureDbReady } from "@/db/bootstrap";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { runAgent } from "@/lib/agent/agent";
import { hasExplicitConfirmation } from "@/lib/agent/guard";
import type {
  AgentMessage,
  LlmProvider,
  ProviderMessage,
  ToolHandler,
  ToolHandlers,
} from "@/lib/agent/types";
import { uniqueMobile } from "./helpers";

/** A scripted LLM: returns canned turns in order; records what it was shown. */
function scriptProvider(turns: Array<{ text?: string; toolCalls?: Array<{ name: string; input: Record<string, unknown> }> }>): LlmProvider & { seen: ProviderMessage[][] } {
  const seen: ProviderMessage[][] = [];
  let index = 0;
  return {
    id: "scripted",
    model: "scripted",
    seen,
    async sendTurn(messages) {
      seen.push(messages);
      const turn = turns[Math.min(index, turns.length - 1)];
      index += 1;
      return {
        text: turn.text ?? "",
        toolCalls: (turn.toolCalls ?? []).map((c, i) => ({ id: `call_${index}_${i}`, ...c })),
      };
    },
  };
}

/** Handlers that invoke the actual route handlers (no HTTP server needed). */
function createDirectHandlers() {
  const spies = { submit: vi.fn(), quote: vi.fn(), schemes: vi.fn() };
  const handlers: ToolHandlers = {
    get_loan_schemes: (async () => {
      spies.schemes();
      const res = await getSchemes();
      return { content: JSON.stringify(await res.json()), isError: !res.ok };
    }) satisfies ToolHandler,
    calculate_quote: (async (input) => {
      spies.quote(input);
      const res = await postQuote(
        new Request("http://localhost/api/v1/quotes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        }),
      );
      return { content: JSON.stringify(await res.json()), isError: !res.ok };
    }) satisfies ToolHandler,
    submit_application: (async (input) => {
      spies.submit(input);
      const res = await postLeads(
        new Request("http://localhost/api/v1/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        }),
      );
      return { content: JSON.stringify(await res.json()), isError: !res.ok };
    }) satisfies ToolHandler,
  };
  return { handlers, spies };
}

const VALID_APPLICATION = {
  applicantName: "Rohit Verma",
  grossWeightGrams: 50,
  netWeightGrams: 45,
  karat: 22,
  planId: "PLAN_EMI_01",
};

import { clearMemoryLeads, listLeads } from "@/server/leads";

beforeEach(async () => {
  clearMemoryLeads();
  try {
    await ensureDbReady();
    await db.delete(leads);
  } catch {
    // DB not available in this test environment; using memory storage
  }
});

describe("confirmation guard (unit)", () => {
  it("accepts an affirmative reply to a confirmation request", () => {
    const convo: AgentMessage[] = [
      { role: "user", content: "Apply with my details: Rohit, 45 g net 50 g gross 22K EMI" },
      { role: "assistant", content: "Here is the full summary… Shall I submit the application?" },
      { role: "user", content: "Yes, go ahead" },
    ];
    expect(hasExplicitConfirmation(convo)).toBe(true);
  });

  it("rejects when the latest user message is a new question (stale confirmation)", () => {
    const convo: AgentMessage[] = [
      { role: "assistant", content: "Shall I submit?" },
      { role: "user", content: "yes" },
      { role: "assistant", content: "It is done." },
      { role: "user", content: "actually wait, what is the EMI interest rate?" },
    ];
    expect(hasExplicitConfirmation(convo)).toBe(false);
  });

  it.each([
    "no",
    "hmm what was the bullet plan again?",
    "yes but change my mobile first",
    "yes, but wait — actually use the Bullet plan instead and hold on while I check",
  ])("rejects non-committal reply %j", (reply) => {
    const convo: AgentMessage[] = [
      { role: "assistant", content: "Please confirm — shall I submit?" },
      { role: "user", content: reply },
    ];
    expect(hasExplicitConfirmation(convo)).toBe(false);
  });
});

describe("agent loop — tool execution safety", () => {
  it("BLOCKS submit_application when the model calls it without user confirmation", async () => {
    const mobile = uniqueMobile();
    const provider = scriptProvider([
      { toolCalls: [{ name: "submit_application", input: { ...VALID_APPLICATION, mobile } }] },
      { text: "I need your explicit confirmation before submitting." },
    ]);
    const { handlers, spies } = createDirectHandlers();

    const result = await runAgent({
      messages: [{ role: "user", content: "Submit my application now: Rohit Verma, " + mobile + ", 50 g gross 45 g net, 22K, EMI plan" }],
      provider,
      handlers,
    });

    // The real API must NEVER have been called.
    expect(spies.submit).not.toHaveBeenCalled();
    const activity = result.toolActivity.find((a) => a.tool === "submit_application");
    expect(activity?.status).toBe("error");
    expect(activity?.detail).toContain("confirmation");
    expect(result.reply).toContain("confirmation");

    // Nothing was persisted.
    const count = await listLeads();
    expect(count.length).toBe(0);
  });

  it("EXECUTES submit_application after explicit confirmation and returns a real applicationId", async () => {
    const mobile = uniqueMobile();
    const conversation: AgentMessage[] = [
      { role: "user", content: "I want a gold loan. Rohit Verma, mobile " + mobile + ", 50 g gross, 45 g net, 22 karat." },
      { role: "assistant", content: "Summary: Rohit Verma, mobile " + mobile + ", gross 50 g, net 45 g, 22K, Monthly EMI at 10.5%, eligible loan ₹2,16,562. Shall I submit the application?" },
      { role: "user", content: "Yes, confirmed. Please submit." },
    ];
    const provider = scriptProvider([
      { toolCalls: [{ name: "submit_application", input: { ...VALID_APPLICATION, mobile } }] },
      { text: "Your application GL-XXXX is submitted." },
    ]);
    const { handlers, spies } = createDirectHandlers();

    const result = await runAgent({ messages: conversation, provider, handlers });

    expect(spies.submit).toHaveBeenCalledTimes(1);
    const activity = result.toolActivity.find((a) => a.tool === "submit_application");
    expect(activity?.status).toBe("ok");

    // Verify the tool result content contained a real 201 payload.
    const toolMessage = provider.seen.flat().find(
      (m) => m.role === "tool" && m.name === "submit_application",
    );
    expect(toolMessage && toolMessage.role === "tool" ? toolMessage.content : "").toContain("GL-");
    const persisted = await listLeads();
    expect(persisted.length).toBe(1);
    expect(persisted[0].eligibleLoanPaise).toBe(21_656_250); // server-side recalculation
  });

  it("returns validation errors to the model when tool arguments are invalid", async () => {
    const provider = scriptProvider([
      { toolCalls: [{ name: "calculate_quote", input: { grossWeightGrams: 40, netWeightGrams: 45, karat: 22 } }] },
      { text: "Net weight cannot exceed gross weight. Could you recheck the weights?" },
    ]);
    const { handlers, spies } = createDirectHandlers();

    const result = await runAgent({
      messages: [{ role: "user", content: "Quote please: 40 gross 45 net 20 karat" }],
      provider,
      handlers,
    });

    expect(spies.quote).not.toHaveBeenCalled(); // rejected before touching the API
    const activity = result.toolActivity[0];
    expect(activity.status).toBe("error");
    const toolContent = provider.seen
      .flat()
      .filter((m): m is Extract<typeof m, { role: "tool" }> => m.role === "tool")
      .map((m) => m.content)
      .join("\n");
    expect(toolContent).toContain("VALIDATION_ERROR");
    expect(toolContent).toContain("Net weight cannot be greater than gross weight");
  });

  it("calculate_quote reaches the real finance service (numbers come from the API, not the model)", async () => {
    const provider = scriptProvider([
      { toolCalls: [{ name: "calculate_quote", input: { grossWeightGrams: 50, netWeightGrams: 45, karat: 22 } }] },
      { text: "Eligible loan is ₹2,16,562 under Monthly EMI." },
    ]);
    const { handlers } = createDirectHandlers();

    await runAgent({
      messages: [{ role: "user", content: "What can I get for 45 g of 22K gold?" }],
      provider,
      handlers,
    });

    const toolContent = provider.seen
      .flat()
      .filter((m): m is Extract<typeof m, { role: "tool" }> => m.role === "tool")
      .map((m) => m.content)
      .join("\n");
    expect(toolContent).toContain("21656250"); // paise computed by the API
    expect(toolContent).toContain("28875000");
  });

  it("duplicate submission via the agent surfaces the 409 with the existing applicationId", async () => {
    const mobile = uniqueMobile();
    const { handlers } = createDirectHandlers();

    const conversationFor = (): AgentMessage[] => [
      { role: "assistant", content: "All details reviewed. Shall I submit the application?" },
      { role: "user", content: "yes, submit" },
    ];
    const submitTurn = () =>
      scriptProvider([
        { toolCalls: [{ name: "submit_application", input: { ...VALID_APPLICATION, mobile } }] },
        { text: "Done." },
      ]);

    const firstProvider = submitTurn();
    const first = await runAgent({ messages: conversationFor(), provider: firstProvider, handlers });
    expect(first.toolActivity[0].status).toBe("ok");
    const firstId = JSON.parse(
      (firstProvider.seen.flat().find(
        (m): m is Extract<typeof m, { role: "tool" }> => m.role === "tool" && m.name === "submit_application",
      )?.content) ?? "{}",
    ).applicationId as string;
    expect(firstId).toMatch(/^GL-/);

    const secondProvider = submitTurn();
    const second = await runAgent({ messages: conversationFor(), provider: secondProvider, handlers });
    expect(second.toolActivity[0].status).toBe("error");

    const secondToolContent = secondProvider.seen
      .flat()
      .filter((m): m is Extract<typeof m, { role: "tool" }> => m.role === "tool")
      .map((m) => m.content)
      .join("\n");
    expect(secondToolContent).toContain("DUPLICATE_APPLICATION");
    expect(secondToolContent).toContain(firstId); // existing applicationId surfaced to the model
  });

  it("handles missing field by rejecting tool arguments and prompting the user for details", async () => {
    // Model attempts submit_application without mobile
    const provider = scriptProvider([
      {
        toolCalls: [
          {
            name: "submit_application",
            input: { applicantName: "Rohit Verma", grossWeightGrams: 50, netWeightGrams: 45, karat: 22, planId: "PLAN_EMI_01" },
          },
        ],
      },
      { text: "Could you please provide your 10-digit mobile number so I can complete your application?" },
    ]);
    const { handlers } = createDirectHandlers();

    const conversation: AgentMessage[] = [
      { role: "assistant", content: "Shall I submit your application?" },
      { role: "user", content: "Yes please" },
    ];

    const result = await runAgent({ messages: conversation, provider, handlers });
    expect(result.toolActivity[0].status).toBe("error");
    expect(result.reply).toContain("mobile number");
  });

  it("politely declines off-topic requests (investment advice / gold price predictions)", async () => {
    const provider = scriptProvider([
      {
        text: "I am Aurum, your gold loan assistant. I can only assist with gold loan plans, indicative quotes, and loan applications. I cannot provide investment advice or predict future gold rates. How can I help with your gold loan today?",
      },
    ]);
    const { handlers } = createDirectHandlers();

    const result = await runAgent({
      messages: [{ role: "user", content: "Should I invest in crypto or buy gold for 5x returns next year?" }],
      provider,
      handlers,
    });

    expect(result.toolActivity.length).toBe(0); // No tools invoked for off-topic query
    expect(result.reply).toContain("gold loan");
    expect(result.reply.toLowerCase()).toContain("cannot provide investment advice");
  });
});

