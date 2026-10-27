import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` is a marker package whose default entry point throws by
      // design: it must never reach a browser bundle. Vitest resolves modules
      // with browser/Node conditions, not the `react-server` one, so importing
      // an AI or auth module under test would blow up on that throw. Aliasing it
      // to an empty module keeps the guard where it actually matters — the
      // Next.js bundler — while letting the server code be unit tested.
      "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
    pool: "threads",
  },
});
