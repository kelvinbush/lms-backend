import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
    // Run tests sequentially to avoid database deadlocks
    // Each test file will run completely before the next starts
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single process sequentially
      },
    },
    // Alternative: limit concurrency to 1
    maxConcurrency: 1,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "test/", "dist/", "drizzle/"],
    },
  },
  resolve: {
    alias: {
      "@/": "./src/",
    },
  },
});
