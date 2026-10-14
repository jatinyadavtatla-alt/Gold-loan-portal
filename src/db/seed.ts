/**
 * Seed script: creates tables if needed and upserts the two loan schemes.
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { ensureDbReady, SEED_SCHEMES } from "./bootstrap";

async function main() {
  await ensureDbReady();
  for (const scheme of SEED_SCHEMES) {
    console.log(
      `Seeded ${scheme.id} — ${scheme.name} @ ${scheme.annualInterestRateBps / 100}% p.a., LTV ${scheme.maxLtvBps / 100}%, ${scheme.tenureMonths} months`,
    );
  }
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
