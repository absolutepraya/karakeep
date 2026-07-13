# Task 6 Report

Implemented local-first bookmark reads and search routing.

- Offline grids query the IndexedDB replica and paginate using local cursors without constructing the bookmark tRPC query.
- A first offline launch with no completed snapshot and no local bookmarks shows an explicit unavailable state.
- Online grids retain the server-provided initial page, show a ready local replica before the first client-side refresh completes, and retain the existing tRPC refresh path.
- Offline search uses `searchBookmarks`; the search field labels results as local-only and states that it searches saved bookmark metadata, notes, links, tags, and lists.

Verification:

- `NO_COLOR=false pnpm --filter @karakeep/web test -- UpdatableBookmarksGrid OfflineLibraryUnavailable` passed: 17 files, 71 tests.
- `NO_COLOR=false pnpm --filter @karakeep/web typecheck` passed.

Remediation:

- Cold offline activation now marks the provider offline before synchronization, and the grid selects the local-only path whenever the browser reports no network.
- The grid defers construction of the server query until the provider reports `online`; pending, failed, and syncing states retain SSR rows until a ready replica or a nonempty local result is available.
- Offline and server search now live in separate render branches, so the offline branch cannot construct the server infinite query.
- Local pagination versions each query generation, drops stale next-page responses, resets the cursor for a new query, and handles local-read failures explicitly.

Regression verification:

- `NO_COLOR=false pnpm --filter @karakeep/web exec vitest run components/dashboard/bookmarks/UpdatableBookmarksGrid.test.tsx components/dashboard/bookmarks/OfflineLibraryUnavailable.test.tsx app/dashboard/search/page.test.tsx lib/offline-library/provider.test.tsx` passed: 4 files, 13 tests.
- `NO_COLOR=false pnpm --filter @karakeep/web typecheck` passed.

RSS feed query remediation:

- Offline bookmark queries now carry `rssFeedId` from `UpdatableBookmarksGrid` through local pagination.
- The offline snapshot replicates owner-scoped bookmark-to-RSS-feed memberships, and the repository filters local pages against those memberships before pagination.
- The replica schema has a dedicated RSS membership table, which is atomically replaced and cleared with the rest of the private replica.

Remediation verification:

- `NO_COLOR=false pnpm --filter @karakeep/web test -- UpdatableBookmarksGrid OfflineLibraryUnavailable repository schema` passed: 21 files, 94 tests.
- `NO_COLOR=false pnpm --filter @karakeep/web typecheck` passed.
- `NO_COLOR=false pnpm --filter @karakeep/trpc test -- offlineSync` passed: 20 files, 426 tests.
