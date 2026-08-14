import { expect, test } from "vitest";

import type { TestDB } from "./testUtils";
import { buildTestContext } from "./testUtils";

let previousDb: TestDB;

test("opens an in-memory test database", async (context) => {
  previousDb = (await buildTestContext(false, context)).db;
  expect(previousDb.$client.open).toBe(true);
});

test("closes the database when the previous test finishes", () => {
  expect(previousDb.$client.open).toBe(false);
});
