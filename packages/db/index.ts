import Database from "better-sqlite3";
import { ExtractTablesWithRelations } from "drizzle-orm";
import { SQLiteTransaction } from "drizzle-orm/sqlite-core";

import * as collaborationScopeSchema from "./collaborationScopes";
import * as baseSchema from "./schema";

const transactionSchema = { ...baseSchema, ...collaborationScopeSchema };

export { listCollaborationScopes } from "./collaborationScopes";
export { db } from "./drizzle";
export type { DB } from "./drizzle";
export * as schema from "./schema";
export { SqliteError } from "better-sqlite3";

// This is exported here to avoid leaking better-sqlite types outside of this package.
export type KarakeepDBTransaction = SQLiteTransaction<
  "sync",
  Database.RunResult,
  typeof transactionSchema,
  ExtractTablesWithRelations<typeof transactionSchema>
>;
