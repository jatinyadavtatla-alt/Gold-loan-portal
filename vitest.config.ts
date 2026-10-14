import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/env.ts"],
    pool: "forks",
    // Tests share one local Postgres; run files sequentially so the
    // duplicate-window and ordering assertions stay deterministic.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
