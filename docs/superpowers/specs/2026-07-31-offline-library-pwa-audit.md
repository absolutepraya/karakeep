# Offline Library PWA Audit

**Date:** 2026-07-31  
**Status:** P0 implemented, pending device verification  
**Related design:** [Offline Library PWA Design](2026-07-12-offline-library-pwa-design.md)

## Purpose

Record the post-implementation findings for the installed mobile PWA. This is
an engineering handoff and resolution ledger. It contains no production
account identifiers, URLs, credentials, or bookmark content.

## Current product decisions

- SQLite remains the authoritative source of truth.
- P0 prevents incorrect and cross-account display before freshness work.
- A cold PWA launch without a network remains unsupported for now. The app
  must first be opened while online.
- Offline creation, deletion, uploads, list membership changes, new tag
  creation, and bulk destructive actions remain out of scope.

## Findings

| ID | Severity | Status | Finding | Evidence |
| --- | --- | --- | --- | --- |
| PWA-001 | P0 | Implemented, pending device verification | Fresh SSR bookmarks were replaced by a ready or nonempty IndexedDB replica during `initializing`, `syncing`, and pre-refetch online states. | `UpdatableBookmarksGrid` selected local data from `isReady || bookmarkCount > 0`. The regression tests reproduce `saved-on-pc` changing to `stale-on-phone`. |
| PWA-002 | P0 | Implemented, pending device verification | A local replica could be read before `OfflineLibraryProvider` validated that it belonged to the current authenticated user. A shared browser profile could briefly render a prior user's bookmarks. | Provider ownership verification and purge run asynchronously; grid reads were previously independent of that check. |
| PWA-003 | P1 | Open | A visible mobile PWA does not periodically synchronize. Desktop changes can remain absent until startup, reconnect, visibility restore, or a manual retry. | The provider listens only to `online`, `offline`, and `visibilitychange`; it registers no foreground interval. |
| PWA-004 | P1 | Open | The library activity indicator reports coordinator state but does not state whether the grid is showing server data or a local replica. Its 15-second query polls background processing, not bookmark-replica freshness. | `ProcessingStatusIndicator` combines `useOfflineLibraryStatus()` with `bookmarks.getProcessingStatus`. |
| PWA-005 | P1 | Accepted limitation | A cold offline launch cannot reliably open the downloaded library. Cached dashboard navigation is limited to five minutes and requires an in-memory session entry for the current service-worker client. | `sw.js` checks `documentCacheSessions.get(event.clientId)` before it can use cached navigation. |
| PWA-006 | P1 | Open | The last successful sync time is memory-only. A cold offline session can have a valid replica but report no last sync time. | `OfflineLibrarySyncCoordinator.lastSyncedAt` initializes to `null` and is not persisted in IndexedDB. |
| PWA-007 | P1 | Open | The browser is never asked to persist storage. Safari or other browsers may evict IndexedDB and thumbnail caches under storage pressure. | The code reads `navigator.storage.estimate()` only for thumbnail eviction. |
| PWA-008 | P2 | Deferred | Offline bookmark updates and tag changes enqueue mutations but do not optimistically update the local replica, so the visible state can stay old until a successful sync. | `useOfflineSafeBookmarkMutation` queues mutations without writing the changed fields to `offlineLibraryDb`. |
| PWA-009 | P2 | Deferred | Offline writes are intentionally narrow: create, delete, upload, list, new-tag, and bulk destructive paths are network-only. | Only `bookmark.update` and `bookmark.tags` are accepted offline mutation kinds. |

## Ruled out for the online stale-bookmark flash

The service worker is not the direct cause of PWA-001. Dashboard navigation is
network-first, and tRPC/RSC requests are explicitly network-only. The sync
backend records bookmark create, update, tag, and delete events, and the
coordinator refreshes its snapshot when a remote delta exists. The defect was
the client grid choosing stale local data before that refresh completed.

## P0 implementation contract

1. When the browser is online, dashboard grids and search use server data only.
   A local replica cannot replace SSR or React Query data during initialization,
   synchronization, or an online sync error.
2. IndexedDB reads require `canReadOfflineReplica`, which becomes true only
   after the replica ownership check completes for the current authenticated
   user.
3. During offline ownership verification, the UI displays a loading state and
   performs no IndexedDB query.
4. A replica is used only after the browser reports offline or the coordinator
   enters its offline state.

## Verification ledger

### P0 regression tests

- `UpdatableBookmarksGrid` keeps `saved-on-pc` visible and does not query a
  local replica during online revalidation.
- `UpdatableBookmarksGrid` does not query an initializing replica over SSR
  bookmarks.
- `UpdatableBookmarksGrid` does not query an offline replica before ownership
  verification.
- Search keeps using server search during replica initialization and does not
  query local search before ownership verification.
- `OfflineLibraryProvider` exposes offline-replica access only after owner
  verification and purges a different user's replica before allowing offline
  reads.

### Focused command

```sh
mise exec -- pnpm --filter @karakeep/web test --run \
  components/dashboard/bookmarks/UpdatableBookmarksGrid.test.tsx \
  app/dashboard/search/page.test.tsx \
  lib/offline-library/provider.test.tsx
```

Expected result after P0: all focused tests pass.

## Follow-up order

1. P1A: add a 30-second foreground sync interval, persist last successful
   sync metadata, and distinguish server versus replica data in the activity
   indicator.
2. P1B: correct offline copy to match the accepted cold-launch limitation and
   make a nonfatal `navigator.storage.persist()` request after a successful
   sync.
3. P2: design durable optimistic local writes and the required temporary-ID,
   dependency, conflict, and queued-state behavior before expanding offline
   mutation coverage.

## Resolution rules

An item may change from `Open` or `Deferred` only after its focused automated
test passes and the relevant mobile-device acceptance check is recorded in the
implementation PR.
