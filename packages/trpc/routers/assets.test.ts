import { beforeEach, describe, expect, test } from "vitest";

import { assets, AssetTypes } from "@karakeep/db/schema";
import { BookmarkTypes, ZAssetType } from "@karakeep/shared/types/bookmarks";

import type { CustomTestContext } from "../testUtils";
import { defaultBeforeEach } from "../testUtils";

beforeEach<CustomTestContext>(defaultBeforeEach(true));

describe("Asset Routes", () => {
  test<CustomTestContext>("mutate assets", async ({ apiCallers, db }) => {
    const api = apiCallers[0].assets;
    const userId = await apiCallers[0].users.whoami().then((u) => u.id);

    const bookmark = await apiCallers[0].bookmarks.createBookmark({
      url: "https://google.com",
      type: BookmarkTypes.LINK,
    });
    await Promise.all([
      db.insert(assets).values({
        id: "asset1",
        assetType: AssetTypes.LINK_SCREENSHOT,
        bookmarkId: bookmark.id,
        userId,
      }),
      db.insert(assets).values({
        id: "asset2",
        assetType: AssetTypes.LINK_BANNER_IMAGE,
        bookmarkId: bookmark.id,
        userId,
      }),
      db.insert(assets).values({
        id: "asset3",
        assetType: AssetTypes.LINK_FULL_PAGE_ARCHIVE,
        bookmarkId: bookmark.id,
        userId,
      }),
      db.insert(assets).values({
        id: "asset4",
        assetType: AssetTypes.UNKNOWN,
        bookmarkId: null,
        userId,
      }),
      db.insert(assets).values({
        id: "asset5",
        assetType: AssetTypes.UNKNOWN,
        bookmarkId: null,
        userId,
      }),
      db.insert(assets).values({
        id: "asset6",
        assetType: AssetTypes.UNKNOWN,
        bookmarkId: null,
        userId,
      }),
    ]);

    const validateAssets = async (
      expected: {
        id: string;
        assetType: ZAssetType;
        fileName: string | null;
      }[],
    ) => {
      const b = await apiCallers[0].bookmarks.getBookmark({
        bookmarkId: bookmark.id,
      });
      b.assets.sort((a, b) => a.id.localeCompare(b.id));
      expect(b.assets).toEqual(expected);
    };

    await api.attachAsset({
      bookmarkId: bookmark.id,
      asset: {
        id: "asset4",
        assetType: "screenshot",
      },
    });

    await validateAssets([
      { id: "asset1", assetType: "screenshot", fileName: null },
      { id: "asset2", assetType: "bannerImage", fileName: null },
      { id: "asset3", assetType: "fullPageArchive", fileName: null },
      { id: "asset4", assetType: "screenshot", fileName: null },
    ]);

    await api.replaceAsset({
      bookmarkId: bookmark.id,
      oldAssetId: "asset1",
      newAssetId: "asset5",
    });

    await validateAssets([
      { id: "asset2", assetType: "bannerImage", fileName: null },
      { id: "asset3", assetType: "fullPageArchive", fileName: null },
      { id: "asset4", assetType: "screenshot", fileName: null },
      { id: "asset5", assetType: "screenshot", fileName: null },
    ]);

    await api.detachAsset({
      bookmarkId: bookmark.id,
      assetId: "asset4",
    });

    await validateAssets([
      { id: "asset2", assetType: "bannerImage", fileName: null },
      { id: "asset3", assetType: "fullPageArchive", fileName: null },
      { id: "asset5", assetType: "screenshot", fileName: null },
    ]);

    // You're not allowed to attach/replace a fullPageArchive
    await expect(
      async () =>
        await api.replaceAsset({
          bookmarkId: bookmark.id,
          oldAssetId: "asset3",
          newAssetId: "asset6",
        }),
    ).rejects.toThrow(/You can't attach this type of asset/);
    await expect(
      async () =>
        await api.attachAsset({
          bookmarkId: bookmark.id,
          asset: {
            id: "asset6",
            assetType: "fullPageArchive",
          },
        }),
    ).rejects.toThrow(/You can't attach this type of asset/);
  });

  test<CustomTestContext>("rejects attachment roles that do not match the asset MIME type", async ({
    apiCallers,
    db,
  }) => {
    const api = apiCallers[0].assets;
    const userId = await apiCallers[0].users.whoami().then((u) => u.id);
    const bookmark = await apiCallers[0].bookmarks.createBookmark({
      url: "https://attachment-types.example",
      type: BookmarkTypes.LINK,
    });

    await db.insert(assets).values({
      id: "video-attachment",
      assetType: AssetTypes.UNKNOWN,
      bookmarkId: null,
      userId,
      contentType: "video/mp4",
    });

    await expect(
      api.attachAsset({
        bookmarkId: bookmark.id,
        asset: { id: "video-attachment", assetType: "bannerImage" },
      }),
    ).rejects.toThrow(/does not match the attachment type/);

    await api.attachAsset({
      bookmarkId: bookmark.id,
      asset: { id: "video-attachment", assetType: "userUploaded" },
    });

    await expect(
      db.query.assets.findFirst({
        where: (table, { eq }) => eq(table.id, "video-attachment"),
      }),
    ).resolves.toMatchObject({
      assetType: AssetTypes.USER_UPLOADED,
      bookmarkId: bookmark.id,
    });
  });

  test<CustomTestContext>("protects and deletes unattached assets through the owner-only mutation", async ({
    apiCallers,
    db,
  }) => {
    const owner = apiCallers[0];
    const ownerUser = await owner.users.whoami();
    const otherUser = await apiCallers[1].users.whoami();

    await db.insert(assets).values({
      id: "other-users-asset",
      assetType: AssetTypes.UNKNOWN,
      bookmarkId: null,
      userId: otherUser.id,
    });

    await expect(
      owner.assets.deleteUnattachedAsset({ assetId: "other-users-asset" }),
    ).rejects.toThrow(/Asset not found/);
    await expect(
      db.query.assets.findFirst({
        where: (table, { eq }) => eq(table.id, "other-users-asset"),
      }),
    ).resolves.toBeDefined();

    const bookmark = await owner.bookmarks.createBookmark({
      url: "https://attached-asset.example",
      type: BookmarkTypes.LINK,
    });
    await db.insert(assets).values({
      id: "attached-asset",
      assetType: AssetTypes.BOOKMARK_ASSET,
      bookmarkId: bookmark.id,
      userId: ownerUser.id,
    });

    await expect(
      owner.assets.deleteUnattachedAsset({ assetId: "attached-asset" }),
    ).rejects.toThrow(/Asset is already attached/);
    await expect(
      db.query.assets.findFirst({
        where: (table, { eq }) => eq(table.id, "attached-asset"),
      }),
    ).resolves.toBeDefined();

    await db.insert(assets).values({
      id: "owned-unattached-asset",
      assetType: AssetTypes.UNKNOWN,
      bookmarkId: null,
      userId: ownerUser.id,
    });

    await owner.assets.deleteUnattachedAsset({
      assetId: "owned-unattached-asset",
    });
    await expect(
      db.query.assets.findFirst({
        where: (table, { eq }) => eq(table.id, "owned-unattached-asset"),
      }),
    ).resolves.toBeUndefined();
  });

  test<CustomTestContext>("blocks attachment while an asset is pending cleanup and allows retrying cleanup", async ({
    apiCallers,
    db,
  }) => {
    const api = apiCallers[0].assets;
    const userId = await apiCallers[0].users.whoami().then((u) => u.id);
    const bookmark = await apiCallers[0].bookmarks.createBookmark({
      url: "https://pending-cleanup.example",
      type: BookmarkTypes.LINK,
    });

    await db.insert(assets).values({
      id: "pending-cleanup-asset",
      assetType: AssetTypes.UNKNOWN,
      bookmarkId: null,
      userId,
      contentType: "image/png",
      cleanupPending: true,
    });

    await expect(
      api.attachAsset({
        bookmarkId: bookmark.id,
        asset: {
          id: "pending-cleanup-asset",
          assetType: "screenshot",
        },
      }),
    ).rejects.toThrow(/unavailable for attachment/);

    await expect(
      db.query.assets.findFirst({
        where: (table, { eq }) => eq(table.id, "pending-cleanup-asset"),
      }),
    ).resolves.toMatchObject({
      assetType: AssetTypes.UNKNOWN,
      bookmarkId: null,
      cleanupPending: true,
    });

    await api.deleteUnattachedAsset({ assetId: "pending-cleanup-asset" });
    await expect(
      db.query.assets.findFirst({
        where: (table, { eq }) => eq(table.id, "pending-cleanup-asset"),
      }),
    ).resolves.toBeUndefined();
  });
});
