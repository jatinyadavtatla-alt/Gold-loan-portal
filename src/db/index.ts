import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __goldLoanPool?: Pool;
};

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

export function isDatabaseConfigured(): boolean {
  const url = getDatabaseUrl();
  return Boolean(url && url.trim().length > 0);
}

// Pool is created with the configured URL, or a local fallback.
// Note: pg.Pool does not open network connections until a query/client is requested.
export const pool =
  globalForDb.__goldLoanPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__goldLoanPool = pool;
}

export const db = drizzle(pool);

