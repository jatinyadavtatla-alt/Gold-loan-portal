import "dotenv/config";
import { ensureDbReady } from "@/db/bootstrap";
import { db } from "@/db";
import { leads } from "@/db/schema";

/**
 * Runs once before the suite: make sure the schema + seed data exist, then
 * clear leads so duplicate-window tests start from a clean slate.
 */
export default async function setup() {
  try {
    await ensureDbReady();
    await db.delete(leads);
    console.log("\n[vitest] schema verified, schemes seeded, leads cleared");
  } catch (error) {
    console.warn("\n[vitest] Notice: PostgreSQL is not reachable at DATABASE_URL.");
    console.warn("[vitest] To run database integration tests, start PostgreSQL (e.g. docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app_db postgres:16).");
  }
}
