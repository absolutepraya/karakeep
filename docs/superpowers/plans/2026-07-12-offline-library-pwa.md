# Offline Library PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Safari-installed iPhone PWA reopen from cached application assets, browse and search a user-scoped offline bookmark library, synchronize supported metadata/tag writes, and expose all connection/sync state through the upgraded header indicator.

**Architecture:** Keep SQLite as Karakeep's only authoritative store. Add a versioned sync journal and a dedicated tRPC sync router that returns authenticated snapshots/deltas and applies idempotent, field-versioned mutation batches. In the browser, a Dexie-backed IndexedDB replica holds the user library and outbox, Cache Storage holds app assets and thumbnails, and a client coordinator reconciles the two stores during sign-in, foreground, and reconnect.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Hono/tRPC, Drizzle SQLite, Dexie IndexedDB, Cache Storage/service workers, TanStack Query, Vitest, Testing Library.

## Global Constraints

- Preserve SQLite as the sole production source of truth. Do not introduce PowerSync, PostgreSQL, MongoDB, or a second authoritative database.
- Target the Safari-installed iPhone PWA first. Keep service-worker behavior standards-based for other browsers.
- Offline data includes all authorized bookmark metadata, lists, tags, local-search fields, and best-effort thumbnails. PDFs and archived reader pages stay online-only.
- Synchronize thumbnails over Wi-Fi and cellular. Under storage pressure, evict least-recently-used thumbnails before metadata or local search.
- Offline-safe writes are bookmark metadata and tag changes only. Uploads, server jobs, sharing, list changes, and bulk destructive actions remain online-only.
- Merge concurrent updates to different bookmark fields. Surface same-field conflicts for explicit user resolution.
- Logout must immediately remove all user-scoped IndexedDB records, thumbnails, local search, conflicts, and outbox entries. The non-sensitive app shell may remain.
- Treat `navigator.onLine` as a hint. Mark the PWA online only after a sync request succeeds.
- The single header control left of the profile menu is the library activity indicator. It must show online/offline state even when idle and retain the current server-processing breakdown.
- Follow existing pnpm, Vitest, oxfmt, oxlint, and tRPC conventions. Run focused tests after every task and commit each independently working task.

---

## File structure and dependency graph

| Path | Responsibility |
|---|---|
| `packages/db/schema.ts` | Persistent sync journal, idempotency receipts, and bookmark field versions. |
| `packages/db/drizzle/0086_add_offline_sync.sql` | Database migration for the sync journal tables and indexes. |
| `packages/shared/types/offlineSync.ts` | Zod contracts shared by browser, router, and tests. |
| `packages/trpc/models/offlineSync.ts` | Server-only snapshot/delta construction, sync-event recording, and atomic mutation application. |
| `packages/trpc/routers/offlineSync.ts` | Authenticated `offlineSync.snapshot`, `offlineSync.pull`, and `offlineSync.push` procedures. |
| `packages/trpc/routers/_app.ts` | Registers `offlineSync` in `AppRouter`. |
| `packages/trpc/routers/bookmarks.ts` | Records bookmark/tag changes in the sync journal without changing existing online route behavior. |
| `packages/trpc/routers/lists.ts` | Records list/member/permission changes needed to remove revoked content. |
| `packages/trpc/routers/offlineSync.test.ts` | Router-level authorization, delta, idempotency, merge, and conflict contracts. |
| `apps/web/public/sw.js` | Service-worker cache-version lifecycle, static/app-shell runtime caching, thumbnail cache handling, and offline document fallback. |
| `apps/web/public/offline.html` | Static no-replica fallback for an offline navigation with no previously visited page. |
| `apps/web/components/pwa/ServiceWorkerRegistration.tsx` | Browser-only registration and update notifications for `/sw.js`. |
| `apps/web/lib/offline-library/schema.ts` | Dexie tables and browser replica schema. |
| `apps/web/lib/offline-library/repository.ts` | Atomic local upsert/remove, query, local search, outbox, conflict, and purge operations. |
| `apps/web/lib/offline-library/sync.ts` | Reconnect/foreground coordinator that pulls, pushes, backs off, and derives activity state. |
| `apps/web/lib/offline-library/provider.tsx` | React context, lifecycle ownership, and dashboard-facing hooks. |
| `apps/web/lib/offline-library/*.test.ts` | Unit contracts for schema, search, eviction metadata, outbox, purge, and coordinator state. |
| `apps/web/lib/providers.tsx` | Installs the PWA and offline-library providers beneath the authenticated session. |
| `apps/web/components/dashboard/header/ProcessingStatusIndicator.tsx` | Becomes the library activity indicator while keeping server task behavior. |
| `apps/web/components/dashboard/header/ProcessingStatusIndicator.test.tsx` | Tests combined connection, sync, conflict, and server-processing states. |
| `apps/web/components/dashboard/bookmarks/UpdatableBookmarksGrid.tsx` | Reads the local replica when available and refreshes it from the existing online query path. |
| `apps/web/components/dashboard/bookmarks/OfflineLibraryUnavailable.tsx` | Explicit state for a first offline launch with no completed local replica. |
| `apps/web/components/dashboard/bookmarks/*.test.tsx` | Covers local-first rendering, unavailable state, and online fallback. |
| `apps/web/package.json` and `pnpm-lock.yaml` | Add `dexie` plus `fake-indexeddb` for browser-replica tests. |

The tasks must be completed in order. Tasks 1 and 2 establish server contracts. Tasks 3 through 5 establish browser storage and caching. Tasks 6 through 8 connect those contracts to existing UI. Task 9 runs the real-device acceptance procedure and publishes it for future operators.

## Task 1: Define sync contracts and persist server version history

**Files:**
- Create: `packages/shared/types/offlineSync.ts`
- Modify: `packages/db/schema.ts`
- Create: `packages/db/drizzle/0086_add_offline_sync.sql`
- Test: `packages/trpc/routers/offlineSync.test.ts`

**Interfaces:**
- Produces `zOfflineSyncSnapshotSchema`, `zOfflineSyncPullInputSchema`, `zOfflineSyncPushInputSchema`, `zOfflineSyncMutationSchema`, `zOfflineSyncConflictSchema`, and inferred `ZOfflineSync*` types.
- Produces DB tables `offlineSyncEvents`, `offlineSyncFieldVersions`, and `offlineSyncMutationReceipts`.
- A sync event is ordered by monotonically increasing `sequence`; a client cursor is its decimal string.

- [ ] **Step 1: Write failing schema-contract tests**

Create tests that parse a valid update mutation and reject an unsupported operation:

```ts
import { describe, expect, test } from "vitest";
import { zOfflineSyncPushInputSchema } from "@karakeep/shared/types/offlineSync";

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
      }),
    ).mutations[0].kind,
    ).toBe("bookmark.update");
  });

  test("rejects uploads and destructive operations", () => {
    expect(() =>
      zOfflineSyncPushInputSchema.parse({
        mutations: [{ idempotencyKey: "x", kind: "bookmark.delete" }],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the new focused test and confirm it fails**

Run: `pnpm --filter @karakeep/trpc test -- offlineSync.test.ts`

Expected: FAIL because `@karakeep/shared/types/offlineSync` does not exist.

- [ ] **Step 3: Add shared Zod contracts and the migration**

Define these exact wire shapes in `packages/shared/types/offlineSync.ts`:

```ts
export const zOfflineSyncMutationSchema = z.discriminatedUnion("kind", [
  z.object({
    idempotencyKey: z.string().uuid(),
    kind: z.literal("bookmark.update"),
    bookmarkId: z.string(),
    fields: z.object({
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
    }).refine((value) => Object.keys(value).length > 0),
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
```

Add these tables through Drizzle and SQL migration:

```sql
CREATE TABLE `offlineSyncEvents` (
  `sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `entityType` text NOT NULL,
  `entityId` text NOT NULL,
  `operation` text NOT NULL,
  `changedFields` text NOT NULL,
  `createdAt` integer NOT NULL
);
CREATE INDEX `offlineSyncEvents_userId_sequence_idx`
  ON `offlineSyncEvents` (`userId`, `sequence`);

CREATE TABLE `offlineSyncFieldVersions` (
  `bookmarkId` text NOT NULL,
  `field` text NOT NULL,
  `version` integer NOT NULL,
  PRIMARY KEY (`bookmarkId`, `field`)
);

CREATE TABLE `offlineSyncMutationReceipts` (
  `userId` text NOT NULL,
  `idempotencyKey` text NOT NULL,
  `result` text NOT NULL,
  `createdAt` integer NOT NULL,
  PRIMARY KEY (`userId`, `idempotencyKey`)
);
```

Use `json` mode for `changedFields` and `result` in the Drizzle definitions. Add foreign keys from `bookmarkId` to `bookmarks.id` with cascade deletion.

- [ ] **Step 4: Make the contract tests pass and generate the database migration**

Run:

```bash
pnpm --filter @karakeep/trpc test -- offlineSync.test.ts
pnpm --filter @karakeep/db typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit the contract layer**

```bash
git add packages/shared/types/offlineSync.ts packages/db/schema.ts packages/db/drizzle/0086_add_offline_sync.sql packages/trpc/routers/offlineSync.test.ts
git commit -m "feat: add offline sync contracts"
```

## Task 2: Implement authenticated snapshot, delta, and idempotent mutation procedures

**Files:**
- Create: `packages/trpc/models/offlineSync.ts`
- Create: `packages/trpc/routers/offlineSync.ts`
- Modify: `packages/trpc/routers/_app.ts`
- Modify: `packages/trpc/routers/bookmarks.ts`
- Modify: `packages/trpc/routers/lists.ts`
- Modify: `packages/trpc/routers/offlineSync.test.ts`

**Interfaces:**
- Consumes Task 1 schemas/tables.
- Produces `offlineSync.snapshot()`, `offlineSync.pull({ cursor })`, and `offlineSync.push({ mutations })` on `AppRouter`.
- Produces `recordOfflineSyncEvent(tx, userId, entityType, entityId, operation, changedFields)` for existing mutations.
- `push` returns `{ acknowledged, conflicts, cursor }`; replays use `offlineSyncMutationReceipts` and return the original result.

- [ ] **Step 1: Add failing router tests for the complete sync contract**

Add tests using the existing `defaultBeforeEach(true)` pattern that assert:

```ts
test<CustomTestContext>("pull returns only the caller's events after its cursor", async ({ apiCallers }) => {
  const owner = apiCallers[0];
  const other = apiCallers[1];
  const bookmark = await owner.bookmarks.createBookmark({
    type: BookmarkTypes.TEXT,
    text: "offline library record",
  });
  await other.bookmarks.createBookmark({ type: BookmarkTypes.TEXT, text: "private" });

  const snapshot = await owner.offlineSync.snapshot();
  const delta = await owner.offlineSync.pull({ cursor: snapshot.cursor });

  expect(snapshot.bookmarks.map((item) => item.id)).toContain(bookmark.id);
  expect(delta.events.every((event) => event.userId !== "")).toBe(true);
  expect(snapshot.bookmarks.map((item) => item.content.type)).not.toContain("private");
});
```

Also test a repeated idempotency key, different-field merge, same-field conflict, tag-set conflict, and revoked shared-list access. Assert that no unauthorized bookmark, list, thumbnail URL, or event is returned.

- [ ] **Step 2: Run the router tests and confirm they fail**

Run: `pnpm --filter @karakeep/trpc test -- offlineSync.test.ts`

Expected: FAIL because `offlineSync` is not registered on `AppRouter`.

- [ ] **Step 3: Implement the server model and router**

In `packages/trpc/models/offlineSync.ts`, implement these exported functions with transaction boundaries:

```ts
export async function buildOfflineSyncSnapshot(ctx: AuthedContext): Promise<ZOfflineSyncSnapshot>;
export async function pullOfflineSyncEvents(ctx: AuthedContext, cursor: string): Promise<ZOfflineSyncPullResult>;
export async function applyOfflineSyncMutations(
  ctx: AuthedContext,
  mutations: ZOfflineSyncMutation[],
): Promise<ZOfflineSyncPushResult>;
export async function recordOfflineSyncEvent(
  tx: SQLiteTransaction,
  userId: string,
  entityType: ZOfflineSyncEntityType,
  entityId: string,
  operation: ZOfflineSyncOperation,
  changedFields: string[],
): Promise<number>;
```

Implementation rules:

- Snapshot serializes exactly the `ZBookmark`/`ZBookmarkList` fields that can be rendered or searched offline. Exclude `htmlContent`, PDF/archive asset content, and server-only credentials.
- Snapshot includes a cursor equal to the highest authorized event sequence after its rows are read in the same transaction.
- Pull returns ordered events with sequence greater than the parsed cursor and a new cursor. A `revoke` event causes the browser to remove the entity and its thumbnail mappings.
- `applyOfflineSyncMutations` checks the receipt table before touching domain tables. It compares every supplied `baseVersions[field]` to `offlineSyncFieldVersions`; return a conflict object with `bookmarkId`, `field`, `localValue`, `serverValue`, and `serverVersion` for mismatches.
- If every requested field matches, call the same domain update logic that existing online routes use, increment one version per changed field, append one event, and save the acknowledged result under the idempotency key before committing.
- Route all write errors as explicit tRPC errors. Do not convert an authorization failure into a conflict.

In the existing bookmark and list mutation transactions, call `recordOfflineSyncEvent` after successful writes. Record all events that can change the offline snapshot: bookmark create/update/delete, tag-set changes, list/member changes, collaborator role changes, and shared-list revocations.

Register `offlineSync` in `packages/trpc/routers/_app.ts`.

- [ ] **Step 4: Run focused server verification**

Run:

```bash
pnpm --filter @karakeep/trpc test -- offlineSync.test.ts
pnpm --filter @karakeep/trpc test -- bookmarks.test.ts lists.test.ts
pnpm --filter @karakeep/trpc typecheck
```

Expected: all tests pass, including existing bookmark/list coverage.

- [ ] **Step 5: Commit the server synchronization boundary**

```bash
git add packages/trpc/models/offlineSync.ts packages/trpc/routers/offlineSync.ts packages/trpc/routers/_app.ts packages/trpc/routers/bookmarks.ts packages/trpc/routers/lists.ts packages/trpc/routers/offlineSync.test.ts
git commit -m "feat: add authenticated offline sync"
```

## Task 3: Add the browser offline-library repository and deterministic local search

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/lib/offline-library/schema.ts`
- Create: `apps/web/lib/offline-library/repository.ts`
- Create: `apps/web/lib/offline-library/schema.test.ts`
- Create: `apps/web/lib/offline-library/repository.test.ts`

**Interfaces:**
- Consumes Task 1 `ZOfflineSyncSnapshot`, `ZOfflineSyncEvent`, mutation, and conflict types.
- Produces `offlineLibraryDb`, `replaceSnapshot`, `applyEvents`, `queryBookmarks`, `searchBookmarks`, `enqueueMutation`, `listPendingMutations`, `saveConflict`, `purgeOfflineLibrary`, `recordThumbnailAccess`, and `evictLeastRecentlyUsedThumbnails`.
- `queryBookmarks` and `searchBookmarks` return `ZBookmark[]` plus pagination data without touching the network.

- [ ] **Step 1: Add dependencies and write failing repository tests**

Add production dependency `dexie` and development dependency `fake-indexeddb` to `apps/web/package.json` using pnpm. In the test setup, install `fake-indexeddb/auto` before opening the Dexie database.

Write tests that prove these contracts:

```ts
test("replaces a snapshot atomically and preserves its cursor", async () => {
  await replaceSnapshot(snapshot);
  await expect(queryBookmarks({ archived: false })).resolves.toMatchObject({
    cursor: snapshot.cursor,
    bookmarks: [{ id: "bookmark-1" }],
  });
});

test("searches only replicated fields", async () => {
  await replaceSnapshot(snapshotWith({ title: "Offline article", note: "airplane" }));
  await expect(searchBookmarks("airplane")).resolves.toMatchObject([
    { id: "bookmark-1" },
  ]);
});

test("purge removes every user-scoped table", async () => {
  await replaceSnapshot(snapshot);
  await enqueueMutation(pendingMutation);
  await purgeOfflineLibrary();
  await expect(offlineLibraryDb.bookmarks.count()).resolves.toBe(0);
  await expect(offlineLibraryDb.outbox.count()).resolves.toBe(0);
});

test("evicts the oldest thumbnail records before bookmark metadata", async () => {
  await replaceSnapshot(snapshot);
  await recordThumbnailAccess("/api/assets/old", new Date("2026-07-11T00:00:00Z"));
  await recordThumbnailAccess("/api/assets/new", new Date("2026-07-12T00:00:00Z"));
  await evictLeastRecentlyUsedThumbnails(1);
  await expect(caches.open("karakeep-thumbnails")).resolves.toBeDefined();
  await expect(offlineLibraryDb.bookmarks.count()).resolves.toBe(1);
});
```

- [ ] **Step 2: Run the repository tests and confirm they fail**

Run: `pnpm --filter @karakeep/web test -- offline-library`

Expected: FAIL because the browser replica modules do not exist.

- [ ] **Step 3: Implement the Dexie schema and repository**

Use this database shape in `schema.ts`:

```ts
class OfflineLibraryDatabase extends Dexie {
  bookmarks!: Table<ZBookmark, string>;
  lists!: Table<ZBookmarkList, string>;
  metadata!: Table<{ key: string; value: string }, string>;
  outbox!: Table<ZOfflineSyncMutation & { queuedAt: number }, string>;
  conflicts!: Table<ZOfflineSyncConflict, string>;
  thumbnailAccess!: Table<{ url: string; lastAccessedAt: number }, string>;

  constructor() {
    super("karakeep-offline-library");
    this.version(1).stores({
      bookmarks: "id, archived, favourited, createdAt, modifiedAt, userId, *tags.id",
      lists: "id, userRole, parentId",
      metadata: "key",
      outbox: "idempotencyKey, bookmarkId, kind, queuedAt",
      conflicts: "id, bookmarkId, field",
      thumbnailAccess: "url, lastAccessedAt",
    });
  }
}
```

Repository rules:

- Store `syncCursor` and `replicaState` in `metadata`.
- Apply snapshots and event batches inside `offlineLibraryDb.transaction("rw", ...)` so readers never see a partial replica.
- The query helper supports `archived`, `favourited`, `tagId`, `listId`, `sortOrder`, `cursor`, and `limit`, matching the subset used by `UpdatableBookmarksGrid`.
- Local search lowercases/tokenizes query text and matches every token against the concatenated replicated title, URL, text, note, summary, tag names, and list names. It must not read `htmlContent`, PDF content, or archive content.
- Outbox insertion updates the local bookmark/tag set in the same transaction. Do not enqueue unsupported mutation kinds.
- `purgeOfflineLibrary` clears every Dexie table and deletes the named Cache Storage thumbnail cache. `evictLeastRecentlyUsedThumbnails(count)` deletes the oldest `thumbnailAccess` URLs from that cache and then removes their access records; it never removes bookmark metadata.

- [ ] **Step 4: Run focused browser-store verification**

Run:

```bash
pnpm --filter @karakeep/web test -- offline-library
pnpm --filter @karakeep/web typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit local replica storage**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/lib/offline-library/schema.ts apps/web/lib/offline-library/repository.ts apps/web/lib/offline-library/schema.test.ts apps/web/lib/offline-library/repository.test.ts
git commit -m "feat: add offline library storage"
```

## Task 4: Add service-worker application and thumbnail caching

**Files:**
- Create: `apps/web/public/sw.js`
- Create: `apps/web/public/offline.html`
- Create: `apps/web/components/pwa/ServiceWorkerRegistration.tsx`
- Create: `apps/web/components/pwa/ServiceWorkerRegistration.test.tsx`
- Modify: `apps/web/lib/providers.tsx`
- Test: `apps/web/components/pwa/ServiceWorkerRegistration.test.tsx`

**Interfaces:**
- Produces a service worker at `/sw.js` with `KARAKEEP_SHELL_CACHE` and `KARAKEEP_THUMBNAIL_CACHE` names that include `self.registration.scope` and a build version literal.
- Produces `<ServiceWorkerRegistration />`, rendered once inside the root layout's client-provider tree.
- The worker responds to `CLEAR_USER_CACHES` messages by deleting only thumbnail caches, never the shell cache.

- [ ] **Step 1: Write failing registration tests**

Mock `navigator.serviceWorker` and assert these exact calls:

```ts
expect(register).toHaveBeenCalledWith("/sw.js", {
  scope: "/",
  updateViaCache: "none",
});

expect(messagePort.postMessage).toHaveBeenCalledWith({
  type: "CLEAR_USER_CACHES",
});
```

- [ ] **Step 2: Run the registration test and confirm it fails**

Run: `pnpm --filter @karakeep/web test -- ServiceWorkerRegistration`

Expected: FAIL because the registration component does not exist.

- [ ] **Step 3: Implement caching boundaries**

Implement `/sw.js` with these fetch strategies:

```js
const isStaticAsset = ({ url }) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest");

const isThumbnail = ({ url }) =>
  url.origin === self.location.origin && url.pathname.startsWith("/api/assets/");
```

- Static assets: cache first, then network; save successful responses under their request URL.
- Navigation documents: network first with a short cache fallback for previously visited authenticated routes. If neither network nor cached page is available, return `/offline.html`, precached during install. The document states that the offline library has not been downloaded yet and asks the user to reconnect once.
- Thumbnail assets: stale while revalidate; update `thumbnailAccess` from the page after successful image use. Never cache PDF/archive content types.
- API/tRPC, auth, mutation, and HTML/RSC data requests: network only. The IndexedDB replica, not an opaque HTTP response cache, owns user data.
- On `activate`, delete only cache names from older app-shell versions. Claim clients only after activation; do not send `skipWaiting` from the registration component.

Implement `ServiceWorkerRegistration` as a client component using `useEffect`, feature detection, and the Next.js-supported registration options. Render it from `Providers` so server rendering never accesses `navigator`.

- [ ] **Step 4: Run focused service-worker verification**

Run:

```bash
pnpm --filter @karakeep/web test -- ServiceWorkerRegistration
pnpm --filter @karakeep/web typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit PWA cache installation**

```bash
git add apps/web/public/sw.js apps/web/public/offline.html apps/web/components/pwa/ServiceWorkerRegistration.tsx apps/web/components/pwa/ServiceWorkerRegistration.test.tsx apps/web/lib/providers.tsx
git commit -m "feat: cache PWA application shell"
```

## Task 5: Implement the offline synchronization coordinator

**Files:**
- Create: `apps/web/lib/offline-library/sync.ts`
- Create: `apps/web/lib/offline-library/provider.tsx`
- Create: `apps/web/lib/offline-library/sync.test.ts`
- Create: `apps/web/lib/offline-library/provider.test.tsx`
- Modify: `apps/web/lib/providers.tsx`

**Interfaces:**
- Consumes Task 2 router methods and Task 3 repository methods.
- Produces `OfflineLibraryProvider`, `useOfflineLibrary`, `useOfflineLibraryStatus`, `syncNow`, `queueBookmarkUpdate`, and `queueBookmarkTags`.
- `OfflineLibraryStatus` is exactly:

```ts
type OfflineLibraryStatus =
  | { kind: "initializing" }
  | { kind: "online"; lastSyncedAt: Date; pendingWrites: number }
  | { kind: "syncing"; phase: "pulling" | "pushing" | "thumbnails"; completed: number; total: number; pendingWrites: number }
  | { kind: "offline"; lastSyncedAt: Date | null; pendingWrites: number }
  | { kind: "error"; message: string; retryAt: Date; pendingWrites: number }
  | { kind: "conflict"; pendingWrites: number; conflictCount: number };
```

- [ ] **Step 1: Write failing coordinator tests**

Test the observable state transitions with mocked router calls and `fake-indexeddb`:

```ts
test("does not mark the replica online until pull succeeds", async () => {
  setNavigatorOnline(true);
  trpc.offlineSync.pull.mockRejectedValueOnce(new Error("captive portal"));
  await expect(syncNow()).rejects.toThrow("captive portal");
  expect(getStatus()).toMatchObject({ kind: "error" });
});

test("replays queued writes once, then applies the returned delta", async () => {
  await enqueueMutation(pendingMutation);
  trpc.offlineSync.push.mockResolvedValueOnce(acknowledgedPush);
  trpc.offlineSync.pull.mockResolvedValueOnce(nextDelta);
  await syncNow();
  expect(trpc.offlineSync.push).toHaveBeenCalledTimes(1);
  await expect(listPendingMutations()).resolves.toHaveLength(0);
});
```

- [ ] **Step 2: Run coordinator tests and confirm they fail**

Run: `pnpm --filter @karakeep/web test -- offline-library/sync`

Expected: FAIL because the coordinator and provider do not exist.

- [ ] **Step 3: Implement lifecycle, retry, and purge behavior**

Implement these rules:

- Start only after `SessionProvider` exposes an authenticated user. If no user exists, invoke `purgeOfflineLibrary` and send `CLEAR_USER_CACHES` to the active worker.
- On first authenticated run, call `offlineSync.snapshot`, write it atomically, then set `online`.
- On subsequent runs, push outbox mutations first, save returned conflicts, then pull deltas from `syncCursor` until the server returns an empty page.
- Trigger `syncNow` on provider mount, `visibilitychange` to visible, and `window` `online`. On `offline`, move to `offline` without discarding data.
- Use exponential delays of 2 seconds, 10 seconds, 30 seconds, and 2 minutes after failures. Stop automatic retries when the document is hidden; retry on foreground/reconnect.
- Do not trust `navigator.onLine` as a successful connection. Transition to `online` only after `snapshot` or `pull` completes.
- Derive `pendingWrites` from the outbox; field conflicts supersede ordinary online state until resolved.
- After a successful thumbnail cache write, call `navigator.storage.estimate()`. If both `usage` and `quota` are available and `usage / quota >= 0.8`, call `evictLeastRecentlyUsedThumbnails` one item at a time until the ratio drops below `0.8` or no thumbnail records remain. If the Storage API is unavailable, retain thumbnails until the browser evicts them.

Expose typed queue functions that reject unsupported write kinds before mutating the replica.

- [ ] **Step 4: Run focused coordinator verification**

Run:

```bash
pnpm --filter @karakeep/web test -- offline-library/sync offline-library/provider
pnpm --filter @karakeep/web typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit sync coordination**

```bash
git add apps/web/lib/offline-library/sync.ts apps/web/lib/offline-library/provider.tsx apps/web/lib/offline-library/sync.test.ts apps/web/lib/offline-library/provider.test.tsx apps/web/lib/providers.tsx
git commit -m "feat: synchronize offline library"
```

## Task 6: Make bookmark grid and search local-first without breaking online SSR

**Files:**
- Create: `apps/web/components/dashboard/bookmarks/OfflineLibraryUnavailable.tsx`
- Create: `apps/web/components/dashboard/bookmarks/OfflineLibraryUnavailable.test.tsx`
- Modify: `apps/web/components/dashboard/bookmarks/UpdatableBookmarksGrid.tsx`
- Create: `apps/web/components/dashboard/bookmarks/UpdatableBookmarksGrid.test.tsx`
- Modify: `apps/web/components/dashboard/search/SearchInput.tsx`
- Test: `apps/web/components/dashboard/bookmarks/UpdatableBookmarksGrid.test.tsx`

**Interfaces:**
- Consumes `useOfflineLibrary` and `useOfflineLibraryStatus` from Task 5.
- Produces a local-first bookmark pagination adapter with the same `BookmarksGrid` props: `bookmarks`, `hasNextPage`, `fetchNextPage`, and `isFetchingNextPage`.
- Produces `OfflineLibraryUnavailable` for a first offline launch without a completed snapshot.

- [ ] **Step 1: Write failing component tests**

Cover these contracts:

```tsx
it("renders the local replica while offline instead of calling getBookmarks", async () => {
  mockOfflineStatus({ kind: "offline", lastSyncedAt: new Date(), pendingWrites: 0 });
  mockLocalQuery([{ id: "cached-bookmark" }]);
  render(<UpdatableBookmarksGrid query={{ archived: false }} bookmarks={serverPage} />);
  expect(await screen.findByText("cached-bookmark")).toBeTruthy();
  expect(mockGetBookmarks).not.toHaveBeenCalled();
});

it("explains that no offline library exists on the first offline launch", () => {
  mockOfflineStatus({ kind: "offline", lastSyncedAt: null, pendingWrites: 0 });
  render(<OfflineLibraryUnavailable />);
  expect(screen.getByText(/offline library has not been downloaded/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run UI tests and confirm they fail**

Run: `pnpm --filter @karakeep/web test -- UpdatableBookmarksGrid OfflineLibraryUnavailable`

Expected: FAIL because the local-first adapter and unavailable component do not exist.

- [ ] **Step 3: Implement local-first rendering and search**

Refactor `UpdatableBookmarksGrid` as follows:

- Preserve the current server-provided `initialBookmarks` as the first online render, avoiding a regression to SSR performance.
- When the provider reports a ready offline replica, read the matching query from `queryBookmarks` and use its cursor for infinite loading.
- When offline, do not create or refetch the tRPC infinite query. Use only the local adapter.
- When online, display local rows immediately, continue the existing tRPC query for freshness, and let successful provider deltas update the replica.
- Render `OfflineLibraryUnavailable` only if offline state has `lastSyncedAt: null` and the local bookmark count is zero.

Update `SearchInput` to route search text through `searchBookmarks` while offline and show a concise local-only result notice. It must not claim PDF/archive full-text coverage. Preserve existing server search when online.

- [ ] **Step 4: Run focused UI verification**

Run:

```bash
pnpm --filter @karakeep/web test -- UpdatableBookmarksGrid OfflineLibraryUnavailable
pnpm --filter @karakeep/web typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit local-first read behavior**

```bash
git add apps/web/components/dashboard/bookmarks/OfflineLibraryUnavailable.tsx apps/web/components/dashboard/bookmarks/OfflineLibraryUnavailable.test.tsx apps/web/components/dashboard/bookmarks/UpdatableBookmarksGrid.tsx apps/web/components/dashboard/bookmarks/UpdatableBookmarksGrid.test.tsx apps/web/components/dashboard/search/SearchInput.tsx
git commit -m "feat: read bookmarks from offline library"
```

## Task 7: Route supported bookmark/tag writes through the offline outbox

**Files:**
- Create: `apps/web/lib/hooks/useOfflineSafeBookmarkMutation.ts`
- Create: `apps/web/lib/hooks/useOfflineSafeBookmarkMutation.test.tsx`
- Modify: `apps/web/components/dashboard/bookmarks/BookmarkActionBar.tsx`
- Modify: `apps/web/components/dashboard/bookmarks/BookmarkOptions.tsx`
- Modify: `apps/web/components/dashboard/bookmarks/BookmarkTagsEditor.tsx`
- Modify: `apps/web/components/dashboard/bookmarks/EditBookmarkDialog.tsx`
- Test: `apps/web/lib/hooks/useOfflineSafeBookmarkMutation.test.tsx`

**Interfaces:**
- Consumes Task 5 `queueBookmarkUpdate`/`queueBookmarkTags` and existing shared-react bookmark hooks.
- Produces `useOfflineSafeBookmarkUpdate()` and `useOfflineSafeBookmarkTags()`.
- The hook returns existing mutation-like fields: `{ mutate, mutateAsync, isPending, error }` so existing controls can adopt it without changing their own UI contracts.

- [ ] **Step 1: Write failing hook tests**

```tsx
it("queues a favourite toggle offline and updates the local card", async () => {
  mockOfflineStatus({ kind: "offline", lastSyncedAt: new Date(), pendingWrites: 0 });
  const { result } = renderHook(() => useOfflineSafeBookmarkUpdate());
  await act(() => result.current.mutateAsync({ bookmarkId: "b1", favourited: true }));
  expect(queueBookmarkUpdate).toHaveBeenCalledWith({ bookmarkId: "b1", favourited: true });
  expect(useUpdateBookmark).not.toHaveBeenCalled();
});

it("uses the existing online mutation when connectivity is verified", async () => {
  mockOfflineStatus({ kind: "online", lastSyncedAt: new Date(), pendingWrites: 0 });
  const { result } = renderHook(() => useOfflineSafeBookmarkUpdate());
  await act(() => result.current.mutateAsync({ bookmarkId: "b1", archived: true }));
  expect(onlineMutateAsync).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the hook tests and confirm they fail**

Run: `pnpm --filter @karakeep/web test -- useOfflineSafeBookmarkMutation`

Expected: FAIL because the offline-safe mutation hooks do not exist.

- [ ] **Step 3: Implement the narrow offline-write boundary**

Implement hooks that:

- Queue only fields admitted by `zOfflineSyncMutationSchema` and tag-set replacements.
- Require a locally known bookmark field version before queuing. If no replica/version exists, disable the operation with an online-required error instead of inventing a base version.
- Preserve existing `useUpdateBookmark` and `useUpdateBookmarkTags` behavior once the provider has verified online connectivity.
- Return a success value that identifies queued work so caller toasts say `Saved offline, will sync when connected` rather than `Updated`.
- Do not wrap upload, recrawl, summarize, list-management, delete, or bulk-action controls. For those existing controls, use the provider status to disable them offline and expose a consistent online-required message.

Adopt these hooks in the single-bookmark action bar, options menu, tag editor, and edit dialog. Keep current component props and accessibility labels stable.

- [ ] **Step 4: Run focused write-path verification**

Run:

```bash
pnpm --filter @karakeep/web test -- useOfflineSafeBookmarkMutation
pnpm --filter @karakeep/web typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit offline-safe writes**

```bash
git add apps/web/lib/hooks/useOfflineSafeBookmarkMutation.ts apps/web/lib/hooks/useOfflineSafeBookmarkMutation.test.tsx apps/web/components/dashboard/bookmarks/BookmarkActionBar.tsx apps/web/components/dashboard/bookmarks/BookmarkOptions.tsx apps/web/components/dashboard/bookmarks/BookmarkTagsEditor.tsx apps/web/components/dashboard/bookmarks/EditBookmarkDialog.tsx
git commit -m "feat: queue supported offline bookmark writes"
```

## Task 8: Upgrade the processing control into the library activity indicator

**Files:**
- Modify: `apps/web/components/dashboard/header/ProcessingStatusIndicator.tsx`
- Modify: `apps/web/components/dashboard/header/ProcessingStatusIndicator.test.tsx`
- Create: `apps/web/components/dashboard/header/LibrarySyncConflictDialog.tsx`
- Create: `apps/web/components/dashboard/header/LibrarySyncConflictDialog.test.tsx`

**Interfaces:**
- Consumes Task 5 `useOfflineLibraryStatus`, pending write count, retry action, and conflict records.
- Produces the existing default export name `ProcessingStatusIndicator` to avoid changing `Header.tsx` imports, but changes its accessible name to `Library activity`.
- Produces `LibrarySyncConflictDialog` with `conflict`, `onChooseLocal`, and `onChooseServer` props.

- [ ] **Step 1: Extend failing indicator tests**

Add exact test cases for online idle, offline, syncing, queued writes, conflict, and coexistence with server processing:

```tsx
it("shows online state while idle", () => {
  mockLibraryStatus({ kind: "online", lastSyncedAt: new Date("2026-07-12T00:00:00Z"), pendingWrites: 0 });
  mockServerProcessing({ total: 0, tasks: [] });
  render(<ProcessingStatusIndicator />);
  expect(screen.getByRole("button", { name: /library activity.*online/i })).toBeTruthy();
});

it("keeps server processing separate from local synchronization", () => {
  mockLibraryStatus({ kind: "syncing", phase: "pulling", completed: 5, total: 10, pendingWrites: 1 });
  mockServerProcessing({ total: 3, tasks: [{ kind: "crawling", count: 3 }] });
  render(<ProcessingStatusIndicator />);
  fireEvent.click(screen.getByRole("button", { name: /library activity/i }));
  expect(screen.getByText("Library sync")).toBeTruthy();
  expect(screen.getByText("Background processing")).toBeTruthy();
});
```

- [ ] **Step 2: Run indicator tests and confirm they fail**

Run: `pnpm --filter @karakeep/web test -- ProcessingStatusIndicator LibrarySyncConflictDialog`

Expected: FAIL because the current indicator has no offline-library state or conflict UI.

- [ ] **Step 3: Implement unified status and conflict resolution**

Implement a single compact control with these visual states:

- Online idle: subtle connected icon and accessible last-sync text.
- Online syncing: animated sync icon plus progress or pending count.
- Offline: offline icon plus pending count when nonzero.
- Error/conflict: attention icon that remains visible until retry or resolution.
- Server background work: retain existing spinner/count and task breakdown.

The popover contains separate `Library sync` and `Background processing` groups. Show last successful sync, current phase, local-only/offline explanatory copy, pending write count, retry action, and a conflict action.

`LibrarySyncConflictDialog` displays the bookmark label, field name, offline value, server value, and two explicit actions. Choosing local requeues the field against the supplied server version. Choosing server removes the local mutation and updates the replica with the server value. Both actions close the conflict only after their repository transaction succeeds.

- [ ] **Step 4: Run focused activity-indicator verification**

Run:

```bash
pnpm --filter @karakeep/web test -- ProcessingStatusIndicator LibrarySyncConflictDialog
pnpm --filter @karakeep/web typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit activity UI**

```bash
git add apps/web/components/dashboard/header/ProcessingStatusIndicator.tsx apps/web/components/dashboard/header/ProcessingStatusIndicator.test.tsx apps/web/components/dashboard/header/LibrarySyncConflictDialog.tsx apps/web/components/dashboard/header/LibrarySyncConflictDialog.test.tsx
git commit -m "feat: show offline library activity"
```

## Task 9: Run device acceptance and publish the operator procedure

**Files:**
- Modify: `docs/fork-setup.md`

**Interfaces:**
- Consumes the completed app, service worker, and automated test suites from Tasks 1 through 8.
- Produces a repeatable real-device acceptance procedure. Automated coverage remains at the router, repository, coordinator, and component layers because the repository has no current authenticated browser-test infrastructure.

- [ ] **Step 1: Add the iPhone PWA acceptance procedure**

Add this exact subsection to `docs/fork-setup.md`:

```md
### Verify the offline iPhone PWA

1. Open Karakeep in Safari on an iPhone and use **Add to Home Screen**.
2. Open the installed app, sign in, and wait until the library activity indicator shows **Online** with a successful sync time.
3. Turn off Wi-Fi and cellular data, force-close the installed app, then reopen it. Confirm the bookmark grid, local-only search, and available thumbnails render without a network request.
4. While offline, change a bookmark title, favorite state, or tags. Confirm the library activity indicator reports a pending write.
5. Restore connectivity. Confirm the pending write disappears after one successful sync and the server state matches the local edit.
6. Create a same-field edit from another signed-in device before reconnecting the offline phone. Confirm Karakeep presents a field-conflict choice instead of overwriting either value silently.
7. Log out on the phone, reopen the installed app offline, and confirm that no bookmarks, thumbnails, search results, pending writes, or conflict records remain.
```

State below it that PDFs, archived reader pages, uploads, crawler/AI jobs, sharing, list mutations, bulk destructive actions, and unsupported edits require a connection.

- [ ] **Step 2: Run all automated contracts**

Run:

```bash
pnpm --filter @karakeep/web test -- offline-library ProcessingStatusIndicator UpdatableBookmarksGrid OfflineLibraryUnavailable useOfflineSafeBookmarkMutation ServiceWorkerRegistration LibrarySyncConflictDialog
pnpm --filter @karakeep/trpc test -- offlineSync.test.ts bookmarks.test.ts lists.test.ts
pnpm --filter @karakeep/web typecheck
pnpm --filter @karakeep/trpc typecheck
pnpm lint
```

Expected: every command exits 0.

- [ ] **Step 3: Perform the documented device acceptance procedure**

Use an iPhone Safari Home Screen installation and execute each numbered check added in Step 1. Capture the exact failing step, library activity state, and network condition if any check fails. Do not declare the PWA feature ready until every check passes.

- [ ] **Step 4: Commit verification instructions**

```bash
git add docs/fork-setup.md
git commit -m "docs: verify offline PWA workflow"
```
