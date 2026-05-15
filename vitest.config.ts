import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    name: "unit",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./client/src/__tests__/setup.ts"],
    include: ["client/src/__tests__/**/*.test.{ts,tsx}"],
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
