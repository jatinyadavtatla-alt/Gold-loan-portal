import {
  ErrorCodes,
  internalError,
  jsonError,
  jsonFromZodError,
  parseJsonBody,
} from "@/lib/api-errors";
import { runAgent } from "@/lib/agent/agent";
import { createHttpToolHandlers } from "@/lib/agent/http-handlers";
import { getProviderFromEnv } from "@/lib/agent/providers";
import { ProviderError } from "@/lib/agent/types";
import { chatRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED_MESSAGE =
  "The AI assistant is not configured yet. Set GOOGLE_API_KEY in the server environment (see .env.example) and restart.";

/** GET /api/v1/chat — availability probe for the frontend. */
export async function GET() {
  const provider = getProviderFromEnv();
  return Response.json({
    available: provider !== null,
    provider: provider?.id ?? null,
    model: provider?.model ?? null,
  });
}

/** POST /api/v1/chat — one agent turn with tool calling. */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    if (body === null) {
      return jsonError(400, ErrorCodes.INVALID_JSON, "Request body must be valid JSON.");
    }

    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonFromZodError(parsed.error);
    }

    const provider = getProviderFromEnv();
    if (!provider) {
      return jsonError(503, ErrorCodes.LLM_NOT_CONFIGURED, NOT_CONFIGURED_MESSAGE, {
        envVars: ["GOOGLE_API_KEY"],
      });
    }

    const origin = new URL(request.url).origin;
    const result = await runAgent({
      messages: parsed.data.messages,
      provider,
      handlers: createHttpToolHandlers(origin),
    });

    return Response.json({
      reply: result.reply,
      toolActivity: result.toolActivity,
      provider: provider.id,
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error(`[api:chat] LLM provider error ${error.status ?? ""}: ${error.message}`.trim());
      return jsonError(
        502,
        ErrorCodes.LLM_UNAVAILABLE,
        "The AI assistant is temporarily unavailable. Please try again shortly, or use the application form.",
      );
    }
    return internalError("chat", error);
  }
}
