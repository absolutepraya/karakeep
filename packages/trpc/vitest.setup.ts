import { afterAll } from "vitest";

import { db } from "@karakeep/db/drizzle";

afterAll(() => {
  if (db.$client.open) {
    db.$client.close();
  }
});
