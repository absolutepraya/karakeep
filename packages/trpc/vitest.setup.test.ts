import { describe, expect, it } from "vitest";

import { getInMemoryDB } from "@karakeep/db/drizzle";

let previousDb: ReturnType<typeof getInMemoryDB> | undefined;

describe.sequential("Vitest SQLite cleanup", () => {
  it("keeps an in-memory database open while its test is running", () => {
    previousDb = getInMemoryDB(false);
    expect(previousDb.$client.open).toBe(true);
  });

  it("closes the previous test database before the next test starts", () => {
    try {
      expect(previousDb?.$client.open).toBe(false);
    } finally {
      if (previousDb?.$client.open) {
        previousDb.$client.close();
      }
    }
  });
});
