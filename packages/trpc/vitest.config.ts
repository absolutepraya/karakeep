/// <reference types="vitest" />

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths({ skip: (dir) => dir === ".claude" })],
  test: {
    pool: "threads",
    poolOptions: {
      threads: {
        // better-sqlite3 supports worker threads. Keeping the TRPC suite in one
        // worker avoids Node 24 child-process teardown racing native cleanup.
        singleThread: true,
      },
    },
    alias: {
      "@/*": "./*",
    },
  },
});
