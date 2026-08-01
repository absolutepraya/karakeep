# Offline Library PWA Audit

**Date:** 2026-07-31  
**Status:** P0 through P4 implemented, pending device verification
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
- Offline creation, uploads, new tag creation, and bulk destructive actions
  remain out of scope. Existing manual-list membership and single-bookmark
  deletion are supported.

## Findings

| ID | Severity | Status | Finding | Evidence |
| --- | --- | --- | --- | --- |
| PWA-001 | P0 | Implemented, pending device verification | Fresh SSR bookmarks were replaced by a ready or nonempty IndexedDB replica during `initializing`, `syncing`, and pre-refetch online states. | `UpdatableBookmarksGrid` selected local data from `isReady || bookmarkCount > 0`. The regression tests reproduce `saved-on-pc` changing to `stale-on-phone`. |
| PWA-002 | P0 | Implemented, pending device verification | A local replica could be read before `OfflineLibraryProvider` validated that it belonged to the current authenticated user. A shared browser profile could briefly render a prior user's bookmarks. | Provider ownership verification and purge run asynchronously; grid reads were previously independent of that check. |
| PWA-003 | P1 | Implemented, pending device verification | A visible mobile PWA did not periodically synchronize. Desktop changes could remain absent until startup, reconnect, visibility restore, or a manual retry. | The provider now requests a sync every 30 seconds only while visible, in addition to its existing lifecycle triggers. An error state retains bounded retry backoff instead of being retried by the interval. |
| PWA-004 | P1 | Implemented, pending device verification | The library activity indicator did not state whether the grid was showing server data or a local replica. Its 15-second query polls background processing, not bookmark-replica freshness. | The indicator now explicitly labels the active source as server data or offline replica. |
| PWA-005 | P1 | Accepted limitation, copy corrected | A cold offline launch cannot reliably open the downloaded library. Cached dashboard navigation is limited to five minutes and requires an in-memory session entry for the current service-worker client. | `sw.js` checks `documentCacheSessions.get(event.clientId)` before it can use cached navigation; `offline.html` now asks the user to reconnect and reopen the app online instead of promising cold offline access. |
| PWA-006 | P1 | Implemented, pending device verification | The last successful sync time was memory-only. A cold offline session could have a valid replica but report no last sync time. | Successful sync time now persists in IndexedDB metadata and hydrates before an offline state is displayed. |
| PWA-007 | P1 | Implemented, pending device verification | The browser was never asked to persist storage. Safari or other browsers may evict IndexedDB and thumbnail caches under storage pressure. | After the first successful sync in a coordinator session, the app makes a best-effort `navigator.storage.persist()` request. A denial or unsupported browser does not affect synchronization. |
| PWA-008 | P2 | Implemented, pending device verification | Offline bookmark updates and tag changes already update the local replica atomically, but offline grids and search read it only once, so the visible state could stay old until a route or query change. | `enqueueMutation` writes the replica and outbox in one transaction. Grid and search readers now subscribe with Dexie `liveQuery`, so those writes repaint the offline UI immediately. |
| PWA-009 | P3 | Implemented, pending device verification | Existing manual-list membership can now be added or removed offline. Creation, uploads, new tags, and bulk actions remain network-only. | `bookmark.listMembership` has explicit set semantics, atomic replica and outbox updates, server-side current access checks, idempotency receipts, and actionable rejection recovery. The staged expansion is recorded in [Offline Mutation Expansion Design](2026-08-01-offline-mutation-expansion-design.md). |
| PWA-010 | P4 | Implemented, pending device verification | A single owned bookmark can now be deleted offline without bypassing the five-second undo window. Bulk deletion remains network-only. | After undo expires, `bookmark.delete` atomically creates a local tombstone and outbox entry. Queries hide tombstones while the original record remains until an authoritative delete event or snapshot settles it. A rejection keeps the tombstone until explicit discard and server refresh. |

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

### P1A regression tests

- Provider schedules a 30-second sync while visible and skips interval work while hidden.
- Successful sync metadata survives a replica replacement and is removed on purge.
- A cold offline coordinator restores the persisted last-sync time.
- The activity indicator states whether server data or the offline replica is
  currently shown.

### P1B regression tests

- The offline fallback does not promise that a cold offline launch can open the
  downloaded library.
- A successful sync requests persistent storage at most once per coordinator
  session, and a denied request does not fail the sync.

### P2 regression tests

- An optimistic offline replica update repaints the visible offline grid without
  a route change or successful synchronization.

### P3 regression tests

- Add and remove membership intent updates IndexedDB and the outbox atomically.
- Repeated intent for one list coalesces without overwriting a separate list.
- Server replay is idempotent and a viewer's revoked edit access becomes an
  actionable rejection.

### P4 regression tests

- A queued deletion hides the bookmark from local grid and search queries while
  retaining the original record behind a tombstone.
- Acknowledgement does not clear a tombstone before an authoritative delete
  event or snapshot arrives.
- Undo prevents outbox creation during the five-second window; a rejected
  deletion is restored only through the explicit discard-and-refresh flow.

## Follow-up order

1. P5: keep bookmark, tag, and list creation, uploads, and bulk destructive
   actions online-only until client IDs, dependent mutation rewriting, and
   durable blob transfer have dedicated designs.

## Resolution rules

An item may change from `Open` or `Deferred` only after its focused automated
test passes and the relevant mobile-device acceptance check is recorded in the
implementation PR.
