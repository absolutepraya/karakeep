import { z } from "zod";

import {
  MAX_NUM_BOOKMARKS_PER_PAGE,
  zPublicBookmarkSchema,
  zSortOrder,
} from "@karakeep/shared/types/bookmarks";
import { zBookmarkListSchema } from "@karakeep/shared/types/lists";
import { zCursorV2 } from "@karakeep/shared/types/pagination";

import { publicProcedure, router } from "../index";
import { List } from "../models/lists";

export const publicBookmarks = router({
  getPublicListMetadata: publicProcedure
    .input(
      z.object({
        listId: z.string(),
      }),
    )
    .output(
      zBookmarkListSchema
        .pick({
          name: true,
          description: true,
          icon: true,
        })
        .extend({
          ownerName: z.string(),
          ownerImage: z.string().nullable(),
        }),
    )
    .query(async ({ input, ctx }) => {
      const metadata = await List.getPublicListMetadata(
        ctx,
        input.listId,
        /* token */ null,
      );
      const owner = await ctx.db.query.users.findFirst({
        columns: {
          image: true,
        },
        where: (users, { eq }) => eq(users.id, metadata.userId),
      });

      return {
        ...metadata,
        ownerImage: owner?.image ?? null,
      };
    }),
  getPublicBookmarksInList: publicProcedure
    .input(
      z.object({
        listId: z.string(),
        cursor: zCursorV2.nullish(),
        limit: z.number().max(MAX_NUM_BOOKMARKS_PER_PAGE).default(20),
        sortOrder: zSortOrder.exclude(["relevance"]).optional().default("desc"),
      }),
    )
    .output(
      z.object({
        list: zBookmarkListSchema
          .pick({
            name: true,
            description: true,
            icon: true,
          })
          .extend({
            numItems: z.number(),
            ownerName: z.string(),
            ownerImage: z.string().nullable(),
          }),
        bookmarks: z.array(zPublicBookmarkSchema),
        nextCursor: zCursorV2.nullable(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const contents = await List.getPublicListContents(
        ctx,
        input.listId,
        /* token */ null,
        {
          limit: input.limit,
          order: input.sortOrder,
          cursor: input.cursor,
        },
      );
      const metadata = await List.getPublicListMetadata(
        ctx,
        input.listId,
        /* token */ null,
      );
      const owner = await ctx.db.query.users.findFirst({
        columns: {
          image: true,
        },
        where: (users, { eq }) => eq(users.id, metadata.userId),
      });

      return {
        ...contents,
        list: {
          ...contents.list,
          ownerImage: owner?.image ?? null,
        },
      };
    }),
});
