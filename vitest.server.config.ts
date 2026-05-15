import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    globals: true,
    setupFiles: ["./server/__tests__/setup.ts"],
    include: ["server/__tests__/**/*.test.ts"],
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
