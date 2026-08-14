/// <reference types="vitest" />

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tsconfigPaths({ skip: (dir) => dir === ".claude" })],
  test: {
    poolOptions: {
      forks: {
        // The TRPC suite uses native better-sqlite3 databases. Reusing one fork
        // lets test cleanup run before Node 24 tears down the worker environment.
        singleFork: true,
      },
    },
    alias: {
      "@/*": "./*",
    },
  },
});
