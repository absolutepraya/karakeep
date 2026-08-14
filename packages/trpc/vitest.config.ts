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
        minThreads: 1,
        maxThreads: 1,
      },
    },
    alias: {
      "@/*": "./*",
    },
  },
});
