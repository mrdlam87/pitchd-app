import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve @/ path aliases from tsconfig (native alias, no plugin needed)
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
