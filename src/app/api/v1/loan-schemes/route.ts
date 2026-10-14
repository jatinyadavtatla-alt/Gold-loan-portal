import { ApiError, internalError, jsonFromApiError } from "@/lib/api-errors";
import { getActiveSchemes, toSchemeDto } from "@/server/plans";

export const dynamic = "force-dynamic";

/** GET /api/v1/loan-schemes — active loan schemes from the database. */
export async function GET() {
  try {
    const schemes = await getActiveSchemes();
    return Response.json({ schemes: schemes.map(toSchemeDto) });
  } catch (error) {
    if (error instanceof ApiError) return jsonFromApiError(error);
    return internalError("loan-schemes", error);
  }
}
