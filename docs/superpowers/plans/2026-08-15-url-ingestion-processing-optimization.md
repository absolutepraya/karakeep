# URL Ingestion Processing Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make newly saved URLs become useful in the UI as soon as core page data is ready, while reducing redundant network/browser/UI work and keeping secondary enrichment in the background.

**Architecture:** Treat URL ingestion as two phases. The core-ready phase produces user-visible metadata, readable content, and a thumbnail, preferring an unfurl/OG image and falling back to a browser screenshot only when needed. Tagging, summarization, search indexing, archival, and other enrichment remain asynchronous and no longer keep bookmark cards or the top-right activity indicator in a loading state.

**Tech Stack:** TypeScript, React, TanStack Query, tRPC, Drizzle/SQLite, Playwright, Vitest, pnpm/Turborepo.

## Global Constraints

- Use `absolutepraya/karakeep` as the source of truth and `main` as the base branch.
- Do not change `CRAWLER_NUM_WORKERS` in repository configuration; the production value lives in the VPS `.env` and will be changed separately later.
- Prefer page-provided unfurl/OG metadata images as thumbnails; generate/store a Chrome screenshot only when the page image is missing or unusable.
- A bookmark becomes UI-ready when core crawl data needed to render the bookmark is available. AI/background enrichment must not keep the bookmark visually loading.
- Keep changes focused; avoid unrelated refactors.
- Add or update tests before production changes and validate focused tests before broad checks.

---

### Task 1: Core-ready loading semantics

**Files:**
- Modify: `packages/shared/utils/bookmarkUtils.ts`
- Test: `packages/shared/utils/bookmarkUtils.test.ts` or the nearest existing bookmark utility test file

**Interfaces:**
- Consumes: existing `ZBookmark` crawl/tagging/summarization fields.
- Produces: loading helpers where link crawl state controls core UI readiness and AI enrichment does not.

- [ ] **Step 1: Write a failing test** proving a crawled link with pending tagging/summarization is not considered UI-loading.
- [ ] **Step 2: Run the focused test and verify the expected failure.**
- [ ] **Step 3: Change `isBookmarkStillLoading` to represent core readiness rather than enrichment readiness.**
- [ ] **Step 4: Run the focused tests and verify they pass.**
- [ ] **Step 5: Commit the behavior change.**

### Task 2: Processing-status semantics and batched refresh

**Files:**
- Modify: `packages/trpc/routers/bookmarks.ts`
- Modify: `packages/trpc/routers/bookmarks.test.ts`
- Modify: `apps/web/components/dashboard/header/ProcessingStatusIndicator.tsx`
- Modify: `apps/web/components/dashboard/header/ProcessingStatusIndicator.test.tsx`
- Modify: `apps/web/components/dashboard/bookmarks/BookmarkCard.tsx`
- Modify: `packages/shared-react/hooks/bookmarks.ts`
- Add a focused shared React hook/helper file if that keeps batching logic isolated.

**Interfaces:**
- Produces a processing response that distinguishes unique core-pending bookmarks from background enrichment counts.
- Produces one shared refresh path for pending bookmarks rather than one `getBookmark` poll per card.

- [ ] **Step 1: Update router tests first** so one pending link counts once as preparing, while tagging/summarizing are background details rather than additive main-count work.
- [ ] **Step 2: Update status-indicator tests first** for the new main count and background-enrichment presentation.
- [ ] **Step 3: Add a failing test for batched pending-bookmark refresh behavior.**
- [ ] **Step 4: Run the focused tests and verify the failures are caused by the old semantics.**
- [ ] **Step 5: Implement the router response and UI changes.**
- [ ] **Step 6: Replace per-card rapid polling with a shared/batched pending-bookmark refresh mechanism.**
- [ ] **Step 7: Ensure successful core-ready updates immediately update React Query caches and decrement the header count.**
- [ ] **Step 8: Run focused router/web/shared-react tests.**
- [ ] **Step 9: Commit the processing-status and polling changes.**

### Task 3: Skip disabled summarization work

**Files:**
- Modify: `packages/trpc/routers/bookmarks.ts`
- Modify: `packages/trpc/routers/bookmarks.test.ts`
- Modify: `apps/workers/workers/crawlerWorker.ts`
- Modify/add crawler worker tests as appropriate.

**Interfaces:**
- A link starts with `summarizationStatus = null` when global auto-summarization is disabled.
- The crawler does not enqueue a summarize job when global auto-summarization is disabled.

- [ ] **Step 1: Write failing router and crawler tests for disabled auto-summarization.**
- [ ] **Step 2: Run them and verify expected failures.**
- [ ] **Step 3: Gate initial status and summarize queueing on `serverConfig.inference.enableAutoSummarization`.**
- [ ] **Step 4: Run focused tests and verify pass.**
- [ ] **Step 5: Commit.**

### Task 4: Bounded multi-URL creation

**Files:**
- Modify: `apps/web/components/dashboard/bookmarks/EditorCard.tsx`
- Modify/add: focused EditorCard tests.

**Interfaces:**
- Multiple pasted URLs are created with a small bounded concurrency pool rather than an unbounded `forEach(mutate)` burst.
- Preserve duplicate notifications, destination-list behavior, form reset, and callbacks.

- [ ] **Step 1: Add a failing test that demonstrates bounded concurrent URL creation.**
- [ ] **Step 2: Run it and verify failure against the current unbounded implementation.**
- [ ] **Step 3: Implement a small concurrency helper and switch multi-URL submission to `mutateAsync`.**
- [ ] **Step 4: Run focused EditorCard tests.**
- [ ] **Step 5: Commit.**

### Task 5: Cheaper content-type preflight

**Files:**
- Modify: `apps/workers/workers/crawlerWorker.ts`
- Modify/add: focused crawler/network tests.

**Interfaces:**
- Try `HEAD` first for content type.
- Fall back safely to the existing GET behavior when HEAD is unsupported, invalid, missing content type, or otherwise insufficient.
- Preserve proxying, URL validation, redirect handling, abort behavior, timeouts, and PDF/image conversion behavior.

- [ ] **Step 1: Write failing tests for HEAD success and GET fallback.**
- [ ] **Step 2: Run and verify failures.**
- [ ] **Step 3: Implement HEAD-first detection with safe fallback.**
- [ ] **Step 4: Run crawler-focused tests.**
- [ ] **Step 5: Commit.**

### Task 6: Unfurl-first thumbnail fallback

**Files:**
- Modify: `apps/workers/workers/crawlerWorker.ts`
- Modify/add: crawler tests covering metadata image success, failed image download, and missing image.
- Confirm: `packages/shared/utils/bookmarkUtils.ts` image-selection order remains compatible.

**Interfaces:**
- Parse page HTML/metadata before deciding whether a screenshot is needed.
- Try to validate/download/store `meta.image` first.
- If the metadata image is usable, do not capture/store a screenshot.
- If metadata image is absent or unusable, capture/store a screenshot while the page/context is still alive.

- [ ] **Step 1: Write failing tests for unfurl success suppressing screenshot capture and unfurl failure triggering screenshot fallback.**
- [ ] **Step 2: Run and verify failures.**
- [ ] **Step 3: Restructure page capture so HTML/metadata parsing precedes screenshot decision while preserving page lifetime for fallback capture.**
- [ ] **Step 4: Persist the chosen thumbnail and core bookmark data before secondary enrichment fan-out.**
- [ ] **Step 5: Run crawler-focused tests.**
- [ ] **Step 6: Commit.**

### Task 7: Final activity UX and validation

**Files:**
- Modify docs only if user-visible behavior or operator workflow documentation currently promises the old semantics.
- No VPS `.env` changes.

**Interfaces:**
- Header main spinner/count represents unique bookmarks still preparing core data.
- Popover exposes background enrichment separately.
- Core-ready cards render immediately even when enrichment is pending.

- [ ] **Step 1: Run `pnpm format:fix`.**
- [ ] **Step 2: Run focused tests for changed packages/apps.**
- [ ] **Step 3: Run `pnpm lint`.**
- [ ] **Step 4: Run `pnpm typecheck`.**
- [ ] **Step 5: Run `pnpm test` or inspect equivalent CI if local execution is unavailable.**
- [ ] **Step 6: Inspect the complete branch diff for unrelated changes.**
- [ ] **Step 7: Open the PR with problem, implementation, validation, and the deferred VPS `CRAWLER_NUM_WORKERS=2` note.**
