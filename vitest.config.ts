import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/bin/**"],
      // Threshold enabled once overall coverage reaches 70% (see tmp/MEMORY.md).
      thresholds: false,
    },
  },
});
