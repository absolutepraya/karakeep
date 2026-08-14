/// <reference types="vitest" />

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths({ skip: (dir) => dir === ".claude" })],
  test: {
    setupFiles: ["./vitest.setup.ts"],
    pool: "threads",
    poolOptions: {
      threads: {
        // better-sqlite3's native cleanup hook crashes when a Vitest worker
        // exits under Node 24. File isolation remains enabled by default.
        singleThread: true,
      },
    },
    alias: {
      "@/*": "./*",
    },
  },
});
