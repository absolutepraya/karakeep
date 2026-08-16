import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { bookmarkLists, users } from "./schema";

/**
 * Direct collaboration scope, shared by pending invitations and accepted
 * memberships. Missing rows intentionally mean non-recursive for backwards
 * compatibility with existing collaboration data.
 */
export const listCollaborationScopes = sqliteTable(
  "listCollaborationScopes",
  {
    listId: text("listId")
      .notNull()
      .references(() => bookmarkLists.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recursive: integer("recursive", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (scope) => [
    primaryKey({ columns: [scope.listId, scope.userId] }),
    index("listCollaborationScopes_userId_idx").on(scope.userId),
  ],
);
