import { onTestFinished, vi } from "vitest";

vi.mock("@karakeep/db/drizzle", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@karakeep/db/drizzle")>();

  return {
    ...original,
    getInMemoryDB(runMigrations: boolean) {
      const db = original.getInMemoryDB(runMigrations);
      onTestFinished(() => {
        if (db.$client.open) {
          db.$client.close();
        }
      });
      return db;
    },
  };
});
