# React Doctor

React Doctor is a pinned root development dependency. The repository scans the five React surfaces that are maintained here: web, browser extension, mobile, landing, and `@karakeep/shared-react`.

## Commands

- `pnpm doctor`: full local scan. It is advisory, skips score reporting and telemetry, and always exits successfully so temporary-package failures do not block local work.
- `pnpm doctor:staged`: advisory scan of the complete Git index snapshot. It avoids React Doctor 0.7.8's source-only `--staged` snapshot, which cannot detect this monorepo's React package manifests.
- `pnpm doctor:ci`: full scan with score reporting. It fails CI unless the combined health score is at least 99.

React Doctor's severity gate is intentionally advisory for these commands. The CI command enforces the numeric score with `scripts/check-react-doctor-score.mjs`, because React Doctor's built-in `--blocking` option gates severity, not score.

## Baseline, 2026-07-17

React Doctor 0.7.8 scanned 563 files. The initial full scan reported 37 findings across 23 files: 14 errors and 23 warnings. Every finding is classified below.

| Category | Severity | Affected files | Finding | Classification |
| --- | --- | --- | --- | --- |
| Performance | warning | `apps/web/app/settings/broken-links/page.tsx` (2), `components/dashboard/BulkBookmarksAction.tsx`, `components/dashboard/bookmarks/TagsEditor.tsx`, `components/dashboard/lists/BookmarkListSelector.tsx` (4), `components/dashboard/sidebar/AllLists.tsx`, `components/settings/WebhookEventSelector.tsx` (2), `lib/bulkTagActions.ts`, `lib/hooks/useUndoableBookmarkDeletion.ts` | `js-set-map-lookups` (13) | Fixed. Dynamic membership checks now use `Set`, or compare the exact route segment. |
| Performance | warning | `apps/web/components/dashboard/bookmarks/DeleteBookmarkConfirmationDialog.tsx` | `rerender-defer-reads-hook` | Fixed. The pathname is read only when the deletion handler runs. |
| Bugs | error | `apps/web/components/pwa/ServiceWorkerRegistration.tsx` (2), `lib/hooks/bookmark-search.ts`, `apps/mobile/app/dashboard/settings/reader-settings.tsx` (2), `packages/shared-react/hooks/reading-progress.ts` (6) | `no-ref-current-in-render` (11) | Fixed. Ref writes now happen in effects or event handlers, and the reading-progress snapshot uses state. |
| Bugs | warning | `apps/web/components/settings/SubscriptionSettings.tsx`, `components/ui/calendar.tsx`, `components/wrapped/WrappedContent.tsx` (2) | `no-locale-format-in-render` (4) | Fixed. Rendered dates use stable UTC or ISO formatting. |
| Bugs | error | `apps/web/components/wrapped/ShareButton.tsx` (2) | `no-unguarded-browser-global-in-render-or-hook-init` | Fixed. Render-time feature detection guards access to `navigator`. |
| Bugs | warning | `apps/web/lib/readerSettings.tsx` | `client-localstorage-no-version` | Fixed. The key is versioned as `karakeep-reader-settings:v1`. |
| Bugs | warning | `apps/web/lib/hooks/useBookmarkImport.ts` | `query-mutation-missing-invalidation` | Fixed. Import completion invalidates import-session list, statistics, and result queries. |
| Security | warning | `apps/web/components/signin/OAuthAutoRedirect.tsx` | `url-prefilled-privileged-action` | Intentionally accepted. The component now permits only a single-root-relative callback URL and rejects protocol-relative and external URLs. React Doctor cannot prove that validation. |
| Bugs | error | `apps/browser-extension/src/utils/settings.ts` | `effect-needs-cleanup` | Tool limitation. The effect already removes the Chrome storage listener. It now also cancels the pending initial settings read. |
| Bugs | warning | `apps/mobile/lib/upload.ts` | `query-mutation-missing-invalidation` | Intentionally accepted. Uploading delegates cache-affecting work to the following `createBookmark` mutation, whose `onSuccess` invalidates bookmark queries. |
| Security | warning | `packages/shared-react/components/BookmarkHtmlHighlighter.tsx` | `dangerous-html-sink` | Intentionally accepted. The rendered archive HTML is sanitized with DOMPurify by the worker's parsing pipeline before it reaches this presentation component. |

The four accepted findings use exact file-and-rule overrides in `doctor.config.json`. Existing configuration also leaves React Native-tagged diagnostics and the Maintainability category out of this cross-platform baseline, since mobile owns native linting and oxfmt, oxlint, Knip, and TypeScript own style, dead-code, and structural checks. Remaining overrides name one file and one intentional pattern only.

The final full scan reports 100/100 for every selected package and no unresolved diagnostics.
