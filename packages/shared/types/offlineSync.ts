import { z } from "zod";

import {
  MAX_BOOKMARK_TITLE_LENGTH,
  zBookmarkSchema,
} from "./bookmarks";
import { zBookmarkListSchema } from "./lists";

export const zOfflineSyncCursorSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, "Cursor must be a decimal sequence");
export type ZOfflineSyncCursor = z.infer<typeof zOfflineSyncCursorSchema>;

export const zOfflineSyncEntityTypeSchema = z.enum(["bookmark", "list"]);
export type ZOfflineSyncEntityType = z.infer<
  typeof zOfflineSyncEntityTypeSchema
>;

export const zOfflineSyncOperationSchema = z.enum([
  "create",
  "update",
  "delete",
  "revoke",
]);
export type ZOfflineSyncOperation = z.infer<typeof zOfflineSyncOperationSchema>;

export const zOfflineSyncMutationSchema = z.discriminatedUnion("kind", [
  z.object({
    idempotencyKey: z.string().uuid(),
    kind: z.literal("bookmark.update"),
    bookmarkId: z.string(),
    fields: z
      .object({
        title: z.string().max(MAX_BOOKMARK_TITLE_LENGTH).nullish().optional(),
        archived: z.boolean().optional(),
        favourited: z.boolean().optional(),
        note: z.string().optional(),
        summary: z.string().nullish().optional(),
        url: z.string().url().optional(),
        description: z.string().nullish().optional(),
        author: z.string().nullish().optional(),
        publisher: z.string().nullish().optional(),
        text: z.string().nullish().optional(),
      })
      .refine((value) => Object.keys(value).length > 0),
    baseVersions: z.record(z.string(), z.number().int().nonnegative()),
  }),
  z.object({
    idempotencyKey: z.string().uuid(),
    kind: z.literal("bookmark.tags"),
    bookmarkId: z.string(),
    tagIds: z.array(z.string()),
    baseVersions: z.object({ tags: z.number().int().nonnegative() }),
  }),
]);
export type ZOfflineSyncMutation = z.infer<typeof zOfflineSyncMutationSchema>;

export const zOfflineSyncPushInputSchema = z.object({
  mutations: z.array(zOfflineSyncMutationSchema),
});
export type ZOfflineSyncPushInput = z.infer<
  typeof zOfflineSyncPushInputSchema
>;

export const zOfflineSyncConflictSchema = z.object({
  bookmarkId: z.string(),
  field: z.string(),
  localValue: z.unknown(),
  serverValue: z.unknown(),
  serverVersion: z.number().int().nonnegative(),
});
export type ZOfflineSyncConflict = z.infer<typeof zOfflineSyncConflictSchema>;

export const zOfflineSyncEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  userId: z.string(),
  entityType: zOfflineSyncEntityTypeSchema,
  entityId: z.string(),
  operation: zOfflineSyncOperationSchema,
  changedFields: z.array(z.string()),
  createdAt: z.coerce.date(),
});
export type ZOfflineSyncEvent = z.infer<typeof zOfflineSyncEventSchema>;

export const zOfflineSyncSnapshotSchema = z.object({
  bookmarks: z.array(zBookmarkSchema),
  lists: z.array(zBookmarkListSchema),
  cursor: zOfflineSyncCursorSchema,
});
export type ZOfflineSyncSnapshot = z.infer<typeof zOfflineSyncSnapshotSchema>;

export const zOfflineSyncPullInputSchema = z.object({
  cursor: zOfflineSyncCursorSchema,
});
export type ZOfflineSyncPullInput = z.infer<typeof zOfflineSyncPullInputSchema>;

export const zOfflineSyncPullResultSchema = z.object({
  events: z.array(zOfflineSyncEventSchema),
  cursor: zOfflineSyncCursorSchema,
});
export type ZOfflineSyncPullResult = z.infer<
  typeof zOfflineSyncPullResultSchema
>;

export const zOfflineSyncPushResultSchema = z.object({
  acknowledged: z.array(z.string().uuid()),
  conflicts: z.array(zOfflineSyncConflictSchema),
  cursor: zOfflineSyncCursorSchema,
});
export type ZOfflineSyncPushResult = z.infer<
  typeof zOfflineSyncPushResultSchema
>;
