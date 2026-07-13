import { z } from "zod";

import { MAX_BOOKMARK_TITLE_LENGTH, zBookmarkSchema } from "./bookmarks";
import { zBookmarkListSchema } from "./lists";

const zOfflineSyncCursorSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, "Cursor must be a decimal sequence");
export type ZOfflineSyncCursor = z.infer<typeof zOfflineSyncCursorSchema>;

const zOfflineSyncEntityTypeSchema = z.enum(["bookmark", "list"]);
export type ZOfflineSyncEntityType = z.infer<
  typeof zOfflineSyncEntityTypeSchema
>;

const zOfflineSyncOperationSchema = z.enum([
  "create",
  "update",
  "delete",
  "revoke",
]);
export type ZOfflineSyncOperation = z.infer<typeof zOfflineSyncOperationSchema>;

export const zOfflineSyncMutationSchema = z.discriminatedUnion("kind", [
  z
    .object({
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
    })
    .superRefine(({ fields, baseVersions }, ctx) => {
      const changedFields = Object.keys(fields);

      for (const field of changedFields) {
        if (!(field in baseVersions)) {
          ctx.addIssue({
            code: "custom",
            message: `Missing base version for changed field "${field}"`,
            path: ["baseVersions", field],
          });
        }
      }

      for (const field of Object.keys(baseVersions)) {
        if (!changedFields.includes(field)) {
          ctx.addIssue({
            code: "custom",
            message: `Base version provided for unchanged field "${field}"`,
            path: ["baseVersions", field],
          });
        }
      }
    }),
  z.object({
    idempotencyKey: z.string().uuid(),
    kind: z.literal("bookmark.tags"),
    bookmarkId: z.string(),
    tagIds: z.array(z.string()),
    baseVersions: z.object({ tags: z.number().int().nonnegative() }).strict(),
  }),
]);
export type ZOfflineSyncMutation = z.infer<typeof zOfflineSyncMutationSchema>;

export const zOfflineSyncPushInputSchema = z.object({
  mutations: z.array(zOfflineSyncMutationSchema).length(1),
});
export type ZOfflineSyncPushInput = z.infer<typeof zOfflineSyncPushInputSchema>;

const zOfflineSyncConflictSchema = z.object({
  bookmarkId: z.string(),
  field: z.string(),
  localValue: z.unknown(),
  serverValue: z.unknown(),
  serverVersion: z.number().int().nonnegative(),
});
export type ZOfflineSyncConflict = z.infer<typeof zOfflineSyncConflictSchema>;

const zOfflineSyncBookmarkFieldVersionSchema = z.object({
  bookmarkId: z.string(),
  field: z.string(),
  version: z.number().int().nonnegative(),
});
export type ZOfflineSyncBookmarkFieldVersion = z.infer<
  typeof zOfflineSyncBookmarkFieldVersionSchema
>;

const zOfflineSyncEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  userId: z.string(),
  entityType: zOfflineSyncEntityTypeSchema,
  entityId: z.string(),
  operation: zOfflineSyncOperationSchema,
  changedFields: z.array(z.string()),
  fieldVersions: z.array(zOfflineSyncBookmarkFieldVersionSchema),
  createdAt: z.coerce.date(),
});
export type ZOfflineSyncEvent = z.infer<typeof zOfflineSyncEventSchema>;

const zOfflineSyncBookmarkListMembershipSchema = z.object({
  bookmarkId: z.string(),
  listId: z.string(),
});
export type ZOfflineSyncBookmarkListMembership = z.infer<
  typeof zOfflineSyncBookmarkListMembershipSchema
>;

const zOfflineSyncBookmarkRssFeedMembershipSchema = z.object({
  bookmarkId: z.string(),
  rssFeedId: z.string(),
});
export type ZOfflineSyncBookmarkRssFeedMembership = z.infer<
  typeof zOfflineSyncBookmarkRssFeedMembershipSchema
>;

export const zOfflineSyncSnapshotSchema = z.object({
  bookmarks: z.array(zBookmarkSchema),
  lists: z.array(zBookmarkListSchema),
  bookmarkListMemberships: z.array(zOfflineSyncBookmarkListMembershipSchema),
  bookmarkRssFeedMemberships: z.array(
    zOfflineSyncBookmarkRssFeedMembershipSchema,
  ),
  bookmarkFieldVersions: z.array(zOfflineSyncBookmarkFieldVersionSchema),
  cursor: zOfflineSyncCursorSchema,
});
export type ZOfflineSyncSnapshot = z.infer<typeof zOfflineSyncSnapshotSchema>;

export const zOfflineSyncPullInputSchema = z.object({
  cursor: zOfflineSyncCursorSchema,
});

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
