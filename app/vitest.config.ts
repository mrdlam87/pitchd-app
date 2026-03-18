import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve @/ path aliases from tsconfig without needing vite-tsconfig-paths plugin
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
});
