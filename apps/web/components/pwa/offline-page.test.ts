import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

const offlinePage = readFileSync("public/offline.html", "utf8");

test("does not promise that a cold offline launch can open the library", () => {
  expect(offlinePage).toContain(
    "Marka needs an internet connection when you open the app.",
  );
  expect(offlinePage).not.toContain(
    "then it will be available when you are offline",
  );
});
