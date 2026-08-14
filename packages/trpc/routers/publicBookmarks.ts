import { eq } from "drizzle-orm";
import { z } from "zod";

import { users } from "@karakeep/db/schema";
import serverConfig from "@karakeep/shared/config";
import {
  createSignedToken,
  getAlignedExpiry,
} from "@karakeep/shared/signedTokens";
import { zAssetSignedTokenSchema } from "@karakeep/shared/types/assets";
import {
  MAX_NUM_BOOKMARKS_PER_PAGE,
  zPublicBookmarkSchema,
  zSortOrder,
} from "@karakeep/shared/types/bookmarks";
import { zBookmarkListSchema } from "@karakeep/shared/types/lists";
import { zCursorV2 } from "@karakeep/shared/types/pagination";

import { publicProcedure, router } from "../index";
import { List } from "../models/lists";

function getPublicSignedAssetUrl(
  assetId: string,
  assetOwnerId: string,
  expireAt: number,
) {
  const payload: z.infer<typeof zAssetSignedTokenSchema> = {
    assetId,
    userId: assetOwnerId,
  };
  const signedToken = createSignedToken(
    payload,
    serverConfig.signingSecret(),
    expireAt,
  );
  return `${serverConfig.publicApiUrl}/public/assets/${assetId}?token=${signedToken}`;
}

function getPublicOwnerImageUrl(image: string | null, userId: string) {
  if (!image) {
    return null;
  }
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return getPublicSignedAssetUrl(image, userId, getAlignedExpiry(3600, 900));
}

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
        .extend({ ownerName: z.string() }),
    )
    .query(async ({ input, ctx }) => {
      return await List.getPublicListMetadata(
        ctx,
        input.listId,
        /* token */ null,
      );
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
        where: eq(users.id, metadata.userId),
      });

      return {
        ...contents,
        list: {
          ...contents.list,
          ownerImage: getPublicOwnerImageUrl(
            owner?.image ?? null,
            metadata.userId,
          ),
        },
      };
    }),
});
