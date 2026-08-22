import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { assets, AssetTypes } from "@karakeep/db/schema";
import { deleteAsset } from "@karakeep/shared/assetdb";
import serverConfig from "@karakeep/shared/config";
import { isContentTypeCompatibleWithAttachment } from "@karakeep/shared/content-support";
import { createSignedToken } from "@karakeep/shared/signedTokens";
import { zAssetSignedTokenSchema } from "@karakeep/shared/types/assets";
import { zAssetTypesSchema } from "@karakeep/shared/types/bookmarks";
import { getAssetUrl } from "@karakeep/shared/utils/assetUtils";

import { AuthedContext } from "..";
import {
  isAllowedToAttachAsset,
  isAllowedToDetachAsset,
  mapDBAssetTypeToUserType,
  mapSchemaAssetTypeToDB,
} from "../lib/attachments";
import { BareBookmark } from "./bookmarks";

export class Asset {
  constructor(
    protected ctx: AuthedContext,
    public asset: typeof assets.$inferSelect,
  ) {}

  static async fromId(ctx: AuthedContext, id: string): Promise<Asset> {
    const assetdb = await ctx.db.query.assets.findFirst({
      where: eq(assets.id, id),
    });

    if (!assetdb) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Asset not found",
      });
    }

    const asset = new Asset(ctx, assetdb);

    if (!(await asset.canUserView())) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Asset not found",
      });
    }

    return asset;
  }

  static async list(
    ctx: AuthedContext,
    input: {
      limit: number;
      cursor: number | null;
    },
  ) {
    const page = input.cursor ?? 1;
    const [results, totalCount] = await Promise.all([
      ctx.db
        .select()
        .from(assets)
        .where(eq(assets.userId, ctx.user.id))
        .orderBy(desc(assets.size))
        .limit(input.limit)
        .offset((page - 1) * input.limit),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(eq(assets.userId, ctx.user.id)),
    ]);

    return {
      assets: results.map((a) => ({
        ...a,
        assetType: mapDBAssetTypeToUserType(a.assetType),
      })),
      nextCursor: page * input.limit < totalCount[0].count ? page + 1 : null,
      totalCount: totalCount[0].count,
    };
  }

  static async attachAsset(
    ctx: AuthedContext,
    input: {
      bookmarkId: string;
      asset: {
        id: string;
        assetType: z.infer<typeof zAssetTypesSchema>;
      };
    },
  ) {
    const [asset] = await Promise.all([
      Asset.fromId(ctx, input.asset.id),
      this.ensureBookmarkOwnership(ctx, input.bookmarkId),
    ]);
    asset.ensureOwnership();

    if (!isAllowedToAttachAsset(input.asset.assetType)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can't attach this type of asset",
      });
    }
    if (
      !isContentTypeCompatibleWithAttachment(
        input.asset.assetType,
        asset.asset.contentType,
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Asset content type does not match the attachment type",
      });
    }

    const [updatedAsset] = await ctx.db
      .update(assets)
      .set({
        assetType: mapSchemaAssetTypeToDB(input.asset.assetType),
        bookmarkId: input.bookmarkId,
      })
      .where(
        and(
          eq(assets.id, input.asset.id),
          eq(assets.userId, ctx.user.id),
          eq(assets.cleanupPending, false),
        ),
      )
      .returning();
    if (!updatedAsset) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Asset is unavailable for attachment",
      });
    }

    return {
      id: updatedAsset.id,
      assetType: mapDBAssetTypeToUserType(updatedAsset.assetType),
      fileName: updatedAsset.fileName,
    };
  }

  static async deleteUnattached(ctx: AuthedContext, assetId: string) {
    const asset = await Asset.fromId(ctx, assetId);
    asset.ensureOwnership();
    if (
      asset.asset.bookmarkId !== null ||
      asset.asset.assetType !== AssetTypes.UNKNOWN
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Asset is already attached",
      });
    }

    const marked = await ctx.db
      .update(assets)
      .set({ cleanupPending: true })
      .where(
        and(
          eq(assets.id, assetId),
          eq(assets.userId, ctx.user.id),
          isNull(assets.bookmarkId),
          eq(assets.assetType, AssetTypes.UNKNOWN),
        ),
      );
    if (marked.changes === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
    }

    // Keep the cleanup state committed while storage deletion is in flight. This
    // blocks attachment mutations and leaves a retryable row on storage failure.
    await deleteAsset({ userId: ctx.user.id, assetId });

    const deleted = await ctx.db
      .delete(assets)
      .where(
        and(
          eq(assets.id, assetId),
          eq(assets.userId, ctx.user.id),
          isNull(assets.bookmarkId),
          eq(assets.assetType, AssetTypes.UNKNOWN),
          eq(assets.cleanupPending, true),
        ),
      );
    if (deleted.changes === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
    }
  }

  static async replaceAsset(
    ctx: AuthedContext,
    input: {
      bookmarkId: string;
      oldAssetId: string;
      newAssetId: string;
    },
  ) {
    const [oldAsset, newAsset] = await Promise.all([
      Asset.fromId(ctx, input.oldAssetId),
      Asset.fromId(ctx, input.newAssetId),
      this.ensureBookmarkOwnership(ctx, input.bookmarkId),
    ]);
    oldAsset.ensureOwnership();
    newAsset.ensureOwnership();

    if (
      !isAllowedToAttachAsset(
        mapDBAssetTypeToUserType(oldAsset.asset.assetType),
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can't attach this type of asset",
      });
    }
    if (
      !isContentTypeCompatibleWithAttachment(
        mapDBAssetTypeToUserType(oldAsset.asset.assetType),
        newAsset.asset.contentType,
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Asset content type does not match the attachment type",
      });
    }

    await ctx.db.transaction(async (tx) => {
      await tx.delete(assets).where(eq(assets.id, input.oldAssetId));
      await tx
        .update(assets)
        .set({
          bookmarkId: input.bookmarkId,
          assetType: oldAsset.asset.assetType,
        })
        .where(eq(assets.id, input.newAssetId));
    });

    await deleteAsset({
      userId: ctx.user.id,
      assetId: input.oldAssetId,
    }).catch(() => ({}));
  }

  static async detachAsset(
    ctx: AuthedContext,
    input: {
      bookmarkId: string;
      assetId: string;
    },
  ) {
    const [asset] = await Promise.all([
      Asset.fromId(ctx, input.assetId),
      this.ensureBookmarkOwnership(ctx, input.bookmarkId),
    ]);

    if (
      !isAllowedToDetachAsset(mapDBAssetTypeToUserType(asset.asset.assetType))
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can't detach this type of asset",
      });
    }

    const result = await ctx.db
      .delete(assets)
      .where(
        and(
          eq(assets.id, input.assetId),
          eq(assets.bookmarkId, input.bookmarkId),
        ),
      );
    if (result.changes == 0) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    await deleteAsset({ userId: ctx.user.id, assetId: input.assetId }).catch(
      () => ({}),
    );
  }

  private static async ensureBookmarkOwnership(
    ctx: AuthedContext,
    bookmarkId: string,
  ) {
    const bookmark = await BareBookmark.bareFromId(ctx, bookmarkId);
    bookmark.ensureOwnership();
  }

  ensureOwnership() {
    if (this.asset.userId != this.ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User is not allowed to access resource",
      });
    }
  }

  static async ensureOwnership(ctx: AuthedContext, assetId: string) {
    return (await Asset.fromId(ctx, assetId)).ensureOwnership();
  }

  async canUserView(): Promise<boolean> {
    // Asset owner can always view it
    if (this.asset.userId === this.ctx.user.id) {
      return true;
    }

    // Avatars are always public
    if (this.asset.assetType === "avatar") {
      return true;
    }

    // If asset is attached to a bookmark, check bookmark access permissions
    if (this.asset.bookmarkId) {
      try {
        // This throws if the user doesn't have access to the bookmark
        await BareBookmark.bareFromId(this.ctx, this.asset.bookmarkId);
        return true;
      } catch (e) {
        if (e instanceof TRPCError && e.code === "FORBIDDEN") {
          return false;
        }
        throw e;
      }
    }

    return false;
  }

  async ensureCanView() {
    if (!(await this.canUserView())) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Asset not found",
      });
    }
  }

  getUrl() {
    return getAssetUrl(this.asset.id);
  }

  static getPublicSignedAssetUrl(
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
}
