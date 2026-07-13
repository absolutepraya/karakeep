import { beforeEach, describe, expect, test } from "vitest";

import { rssFeedImportsTable } from "@karakeep/db/schema";

import { BookmarkTypes } from "@karakeep/shared/types/bookmarks";
import {
  zOfflineSyncPullInputSchema,
  zOfflineSyncPushInputSchema,
} from "@karakeep/shared/types/offlineSync";
import type { CustomTestContext } from "../testUtils";
import { defaultBeforeEach } from "../testUtils";

beforeEach<CustomTestContext>(defaultBeforeEach(true));

describe("offline sync contracts", () => {

  test("accepts a field-versioned bookmark update", () => {
    expect(
      zOfflineSyncPushInputSchema.parse({
        mutations: [
          {
            idempotencyKey: "0a42a35d-afe8-4b34-91ba-1ca4767c1fe0",
            bookmarkId: "bookmark-1",
            kind: "bookmark.update",
            fields: { title: "Read later" },
            baseVersions: { title: 7 },
          },
        ],
      }).mutations[0].kind,
    ).toBe("bookmark.update");
  });

  test("accepts exactly one mutation per push", () => {
    const mutation = {
      idempotencyKey: "0a42a35d-afe8-4b34-91ba-1ca4767c1fe0",
      bookmarkId: "bookmark-1",
      kind: "bookmark.update" as const,
      fields: { title: "Read later" },
      baseVersions: { title: 7 },
    };
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [mutation, { ...mutation, idempotencyKey: "2d068a43-97e4-4417-9ca3-202fd12415d5" }],
      }),
    ).toThrow();
  });

  test("rejects uploads and destructive operations", () => {
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [{ idempotencyKey: "x", kind: "bookmark.delete" }],
      }),
    ).toThrow();
  });
  test("accepts a versioned bookmark tag update", () => {
    expect(
      zOfflineSyncPushInputSchema.parse({
        mutations: [
          {
            idempotencyKey: "2d068a43-97e4-4417-9ca3-202fd12415d5",
            bookmarkId: "bookmark-1",
            kind: "bookmark.tags",
            tagIds: ["tag-1"],
            baseVersions: { tags: 3 },
          },
        ],
      }).mutations[0].kind,
    ).toBe("bookmark.tags");
  });

  test("rejects an update without changed fields", () => {
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [
          {
            idempotencyKey: "e6fa59f6-f45d-43a0-9284-08f6c245e07e",
            bookmarkId: "bookmark-1",
            kind: "bookmark.update",
            fields: {},
            baseVersions: {},
          },
        ],
      }),
    ).toThrow();
  });

  test("rejects invalid idempotency keys and cursors", () => {
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [
          {
            idempotencyKey: "not-a-uuid",
            bookmarkId: "bookmark-1",
            kind: "bookmark.tags",
            tagIds: [],
            baseVersions: { tags: 0 },
          },
        ],
      }),
    ).toThrow();
    expect(() => zOfflineSyncPullInputSchema.parse({ cursor: "-1" })).toThrow();
  });

  test("requires base versions for exactly the changed bookmark fields", () => {
    const mutation = {
      idempotencyKey: "4e50ebfa-8859-48d5-b9a4-dfe8324b85ae",
      bookmarkId: "bookmark-1",
      kind: "bookmark.update" as const,
      fields: { title: "Read later" },
    };

    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [{ ...mutation, baseVersions: {} }],
      }),
    ).toThrow();
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [{ ...mutation, baseVersions: { title: 7, note: 2 } }],
      }),
    ).toThrow();
  });
});

describe("Offline sync routes", () => {
  test<CustomTestContext>("pull returns only the caller's events after its cursor", async ({
    apiCallers,
  }) => {
    const owner = apiCallers[0];
    const other = apiCallers[1];
    const bookmark = await owner.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "offline library record",
    });
    const privateBookmark = await other.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "private",
    });

    const snapshot = await owner.offlineSync.snapshot();
    const delta = await owner.offlineSync.pull({ cursor: snapshot.cursor });

    expect(snapshot.bookmarks.map((item) => item.id)).toContain(bookmark.id);
    expect(snapshot.bookmarks.map((item) => item.id)).not.toContain(
      privateBookmark.id,
    );
    expect(delta.events).toEqual([]);
  });

  test<CustomTestContext>("scopes snapshot memberships to accessible lists", async ({
    apiCallers,
  }) => {
    const owner = apiCallers[0];
    const other = apiCallers[1];
    const ownerBookmark = await owner.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "owned membership",
    });
    const otherBookmark = await other.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "foreign membership",
    });
    const ownerList = await owner.lists.create({
      name: "Owner list",
      icon: "folder",
      type: "manual",
    });
    const otherList = await other.lists.create({
      name: "Other list",
      icon: "folder",
      type: "manual",
    });
    await owner.lists.addToList({
      listId: ownerList.id,
      bookmarkId: ownerBookmark.id,
    });
    await other.lists.addToList({
      listId: otherList.id,
      bookmarkId: otherBookmark.id,
    });

    const snapshot = await owner.offlineSync.snapshot();

    expect(snapshot.bookmarkListMemberships).toContainEqual({
      bookmarkId: ownerBookmark.id,
      listId: ownerList.id,
    });
    expect(snapshot.bookmarkListMemberships).not.toContainEqual({
      bookmarkId: otherBookmark.id,
      listId: otherList.id,
    });
  });

  test<CustomTestContext>("replicates RSS feed memberships for the owner's bookmarks", async ({
    apiCallers,
    db,
  }) => {
    const owner = apiCallers[0];
    const rssBookmark = await owner.bookmarks.createBookmark({
      type: BookmarkTypes.LINK,
      url: "https://example.com/rss-entry",
    });
    const feed = await owner.feeds.create({
      name: "Offline feed",
      url: "https://example.com/feed.xml",
      enabled: true,
    });
    await db.insert(rssFeedImportsTable).values({
      rssFeedId: feed.id,
      entryId: "entry-1",
      bookmarkId: rssBookmark.id,
    });

    const snapshot = await owner.offlineSync.snapshot();

    expect(snapshot.bookmarkRssFeedMemberships).toContainEqual({
      bookmarkId: rssBookmark.id,
      rssFeedId: feed.id,
    });
  });

  test<CustomTestContext>("returns only ordered caller deltas after a cursor", async ({
    apiCallers,
  }) => {
    const owner = apiCallers[0];
    const other = apiCallers[1];
    const bookmark = await owner.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "owner record",
    });
    const snapshot = await owner.offlineSync.snapshot();
    await owner.bookmarks.updateBookmark({
      bookmarkId: bookmark.id,
      title: "first owner delta",
    });
    const foreignBookmark = await other.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "foreign private record",
    });
    const secondOwnerBookmark = await owner.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "second owner delta",
    });
    const foreignList = await other.lists.create({
      name: "foreign private list",
      icon: "folder",
      type: "manual",
    });

    const delta = await owner.offlineSync.pull({ cursor: snapshot.cursor });

    expect(delta.events).toHaveLength(2);
    expect(delta.events.map((event) => event.sequence)).toEqual(
      delta.events.map((event) => event.sequence).sort((a, b) => a - b),
    );
    expect(delta.events.map((event) => event.entityId)).toEqual([
      bookmark.id,
      secondOwnerBookmark.id,
    ]);
    expect(delta.events.map((event) => event.entityId)).not.toContain(
      foreignBookmark.id,
    );
    expect(snapshot.bookmarks.map((item) => item.id)).not.toContain(
      foreignBookmark.id,
    );
    expect(snapshot.lists.map((item) => item.id)).not.toContain(foreignList.id);
    expect(
      JSON.stringify({ snapshot, delta }).includes(foreignBookmark.id),
    ).toBe(false);
  });

  test<CustomTestContext>("returns only authorized current field versions in snapshots and deltas", async ({
    apiCallers,
  }) => {
    const owner = apiCallers[0];
    const other = apiCallers[1];
    const ownerBookmark = await owner.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "owned version",
    });
    const otherBookmark = await other.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "foreign version",
    });
    await owner.bookmarks.updateBookmark({
      bookmarkId: ownerBookmark.id,
      title: "owned title v1",
    });
    await other.bookmarks.updateBookmark({
      bookmarkId: otherBookmark.id,
      title: "foreign title v1",
    });

    const snapshot = await owner.offlineSync.snapshot();
    expect(snapshot.bookmarkFieldVersions).toContainEqual({
      bookmarkId: ownerBookmark.id,
      field: "title",
      version: 1,
    });
    expect(snapshot.bookmarkFieldVersions).not.toContainEqual(
      expect.objectContaining({ bookmarkId: otherBookmark.id }),
    );

    await owner.bookmarks.updateBookmark({
      bookmarkId: ownerBookmark.id,
      note: "owned note v1",
    });
    const delta = await owner.offlineSync.pull({ cursor: snapshot.cursor });

    expect(delta.events).toContainEqual(
      expect.objectContaining({
        entityId: ownerBookmark.id,
        changedFields: ["note"],
        fieldVersions: [
          { bookmarkId: ownerBookmark.id, field: "note", version: 1 },
        ],
      }),
    );
  });

  test<CustomTestContext>("replays mutations and merges independent fields while rejecting stale fields", async ({
    apiCallers,
  }) => {
    const api = apiCallers[0];
    const bookmark = await api.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "offline library record",
    });
    const titleMutation = {
      idempotencyKey: "4b687efc-6212-4c34-b758-e72338ef8c4e",
      kind: "bookmark.update" as const,
      bookmarkId: bookmark.id,
      fields: { title: "from phone" },
      baseVersions: { title: 0 },
    };

    const first = await api.offlineSync.push({ mutations: [titleMutation] });
    const replay = await api.offlineSync.push({ mutations: [titleMutation] });
    const independentField = await api.offlineSync.push({
      mutations: [
        {
          idempotencyKey: "bd6b94d7-2fc1-4100-bf5a-f866c40bfbdc",
          kind: "bookmark.update",
          bookmarkId: bookmark.id,
          fields: { note: "merged note" },
          baseVersions: { note: 0 },
        },
      ],
    });
    const conflict = await api.offlineSync.push({
      mutations: [
        {
          idempotencyKey: "7d3ced67-588d-4a40-a00a-8c4902d500c0",
          kind: "bookmark.update",
          bookmarkId: bookmark.id,
          fields: { title: "stale title" },
          baseVersions: { title: 0 },
        },
      ],
    });

    expect(replay).toEqual(first);
    expect(independentField.acknowledged).toHaveLength(1);
    expect(conflict.conflicts).toEqual([
      expect.objectContaining({
        bookmarkId: bookmark.id,
        field: "title",
        localValue: "stale title",
        serverValue: "from phone",
        serverVersion: 1,
      }),
    ]);
  });

  test<CustomTestContext>("rejects a stale tag set as one field", async ({
    apiCallers,
  }) => {
    const api = apiCallers[0];
    const bookmark = await api.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "offline library record",
    });
    const tag = await api.tags.create({ name: "travel" });

    await api.offlineSync.push({
      mutations: [
        {
          idempotencyKey: "f3ad6f4a-e2d5-4435-baab-f4c48a841c99",
          kind: "bookmark.tags",
          bookmarkId: bookmark.id,
          tagIds: [tag.id],
          baseVersions: { tags: 0 },
        },
      ],
    });
    const conflict = await api.offlineSync.push({
      mutations: [
        {
          idempotencyKey: "133b4960-ed90-4825-a918-861f7420e93a",
          kind: "bookmark.tags",
          bookmarkId: bookmark.id,
          tagIds: [],
          baseVersions: { tags: 0 },
        },
      ],
    });

    expect(conflict.conflicts).toEqual([
      expect.objectContaining({
        bookmarkId: bookmark.id,
        field: "tags",
        localValue: [],
        serverVersion: 1,
      }),
    ]);
  });

  test<CustomTestContext>("emits a revocation and no longer returns revoked shared content", async ({
    apiCallers,
  }) => {
    const owner = apiCallers[0];
    const collaborator = apiCallers[1];
    const bookmark = await owner.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "shared offline record",
    });
    const list = await owner.lists.create({
      name: "Shared",
      icon: "folder",
      type: "manual",
    });
    await owner.lists.addToList({ listId: list.id, bookmarkId: bookmark.id });
    const collaboratorUser = await collaborator.users.whoami();
    const { invitationId } = await owner.lists.addCollaborator({
      listId: list.id,
      email: collaboratorUser.email!,
      role: "viewer",
    });
    await collaborator.lists.acceptInvitation({ invitationId });

    const beforeRevocation = await collaborator.offlineSync.snapshot();
    await owner.lists.removeCollaborator({
      listId: list.id,
      userId: collaboratorUser.id,
    });
    const afterRevocation = await collaborator.offlineSync.pull({
      cursor: beforeRevocation.cursor,
    });
    const snapshot = await collaborator.offlineSync.snapshot();

    expect(beforeRevocation.bookmarks.map((item) => item.id)).toContain(bookmark.id);
    expect(beforeRevocation.bookmarkListMemberships).toContainEqual({
      bookmarkId: bookmark.id,
      listId: list.id,
    });
    expect(afterRevocation.events).toContainEqual(
      expect.objectContaining({
        entityType: "list",
        entityId: list.id,
        operation: "revoke",
      }),
    );
    expect(snapshot.bookmarks.map((item) => item.id)).not.toContain(bookmark.id);
    expect(snapshot.lists.map((item) => item.id)).not.toContain(list.id);
    expect(snapshot.bookmarkListMemberships).not.toContainEqual({
      bookmarkId: bookmark.id,
      listId: list.id,
    });
  });

  test<CustomTestContext>("withholds historical bookmark field versions after a collaborator is revoked", async ({
    apiCallers,
  }) => {
    const owner = apiCallers[0];
    const collaborator = apiCallers[1];
    const bookmark = await owner.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "historical shared offline record",
    });
    const list = await owner.lists.create({
      name: "Shared",
      icon: "folder",
      type: "manual",
    });
    await owner.lists.addToList({ listId: list.id, bookmarkId: bookmark.id });
    const collaboratorUser = await collaborator.users.whoami();
    const { invitationId } = await owner.lists.addCollaborator({
      listId: list.id,
      email: collaboratorUser.email!,
      role: "viewer",
    });
    await collaborator.lists.acceptInvitation({ invitationId });

    const beforeUpdate = await collaborator.offlineSync.snapshot();
    await owner.bookmarks.updateBookmark({
      bookmarkId: bookmark.id,
      title: "updated before revocation",
    });
    await owner.lists.removeCollaborator({
      listId: list.id,
      userId: collaboratorUser.id,
    });

    const delta = await collaborator.offlineSync.pull({
      cursor: beforeUpdate.cursor,
    });

    expect(delta.events).toContainEqual(
      expect.objectContaining({
        entityType: "bookmark",
        entityId: bookmark.id,
        changedFields: ["title"],
        fieldVersions: [],
      }),
    );
    expect(delta.events).toContainEqual(
      expect.objectContaining({
        entityType: "list",
        entityId: list.id,
        operation: "revoke",
        fieldVersions: [],
      }),
    );
    expect(
      delta.events.flatMap((event) =>
        event.fieldVersions.filter(
          (fieldVersion) => fieldVersion.bookmarkId === bookmark.id,
        ),
      ),
    ).toEqual([]);
  });

  test<CustomTestContext>("delivers owner bookmark updates and deletes to shared collaborators", async ({
    apiCallers,
  }) => {
    const owner = apiCallers[0];
    const collaborator = apiCallers[1];
    const bookmark = await owner.bookmarks.createBookmark({
      type: BookmarkTypes.TEXT,
      text: "shared content",
    });
    const list = await owner.lists.create({
      name: "Shared",
      icon: "folder",
      type: "manual",
    });
    await owner.lists.addToList({ listId: list.id, bookmarkId: bookmark.id });
    const collaboratorUser = await collaborator.users.whoami();
    const { invitationId } = await owner.lists.addCollaborator({
      listId: list.id,
      email: collaboratorUser.email!,
      role: "viewer",
    });
    await collaborator.lists.acceptInvitation({ invitationId });
    const beforeUpdate = await collaborator.offlineSync.snapshot();

    await owner.bookmarks.updateBookmark({
      bookmarkId: bookmark.id,
      title: "updated by owner",
    });
    const afterUpdate = await collaborator.offlineSync.pull({
      cursor: beforeUpdate.cursor,
    });
    const versionOnePush = await owner.offlineSync.push({
      mutations: [
        {
          idempotencyKey: "8ca4a420-602a-4e5a-b5f2-05be95a49461",
          kind: "bookmark.update",
          bookmarkId: bookmark.id,
          fields: { title: "offline version one" },
          baseVersions: { title: 1 },
        },
      ],
    });
    await owner.bookmarks.deleteBookmark({ bookmarkId: bookmark.id });
    const afterDelete = await collaborator.offlineSync.pull({
      cursor: afterUpdate.cursor,
    });

    expect(afterUpdate.events).toEqual([
      expect.objectContaining({
        userId: collaboratorUser.id,
        entityType: "bookmark",
        entityId: bookmark.id,
        operation: "update",
      }),
    ]);
    expect(versionOnePush.acknowledged).toEqual([
      "8ca4a420-602a-4e5a-b5f2-05be95a49461",
    ]);
    expect(afterDelete.events).toEqual([
      expect.objectContaining({
        userId: collaboratorUser.id,
        entityType: "bookmark",
        entityId: bookmark.id,
        operation: "update",
      }),
      expect.objectContaining({
        userId: collaboratorUser.id,
        entityType: "bookmark",
        entityId: bookmark.id,
        operation: "delete",
      }),
    ]);
  });
});
