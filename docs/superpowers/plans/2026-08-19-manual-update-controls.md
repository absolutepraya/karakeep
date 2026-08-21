# Manual Update Controls Implementation Plan

**Goal:** Add a reliable, compact manual update/check mechanism beside the existing automatic PWA update staging flow.

**Architecture:** Keep `ServiceWorkerRegistration` as the single PWA lifecycle owner. It will expose explicit version-check and activation actions, validate build identities, and report blocked/error states. `SidebarVersion` will render the shared horizontal status row, while `ProfileOptions` will render the update dot on the avatar. Production Docker builds will embed the same full SHA that `/api/version` returns.

**Tech Stack:** Next.js 16, React, TypeScript, service workers, Tailwind CSS, Vitest, Docker Buildx.

**Spec:** `docs/superpowers/specs/2026-08-16-pwa-version-updates-design.md`

## Global Constraints

- Preserve the existing scope `/` and `updateViaCache: "none"` service-worker contract.
- Never reload the document that discovers a newer deployment unless the user explicitly activates the waiting update.
- Keep multi-window activation safety: the worker may call `skipWaiting()` only for the sole relevant window client.
- Treat `development`, `unknown`, missing, and malformed build values as invalid for update comparison.
- Use the full Git SHA for identity and the first 7 characters only for display.
- Do not add a modal, confirmation prompt, or new dependency.
- Preserve logout cache clearing, document-cache session scoping, thumbnail tracking, and offline-library synchronization.

### Task 1: Align production build identity

**Files:**
- Modify: `docker/Dockerfile`
- Modify: `apps/web/next.config.mjs`

- [x] **Step 1: Make the frontend build consume `SERVER_VERSION`**
  Declare `ARG SERVER_VERSION` and `ENV SERVER_VERSION=${SERVER_VERSION}` in the builder stage before `next build` runs. Keep the runtime stage argument unchanged.
- [x] **Step 2: Use full SHA for local fallback**
  Change the local fallback to `git rev-parse HEAD`.
- [x] **Step 3: Validate build identity wiring**
  Run `git diff --check` and inspect the Dockerfile ordering to confirm the argument is available before the web build.

### Task 2: Expand PWA lifecycle actions

**Files:**
- Modify: `apps/web/components/pwa/ServiceWorkerRegistration.tsx`
- Test: `apps/web/components/pwa/ServiceWorkerRegistration.test.tsx`
- Test: `apps/web/components/pwa/ServiceWorkerRegistration.readiness.test.tsx`
- Test: `apps/web/components/pwa/sw.test.ts`

- [x] **Step 1: Add explicit lifecycle state**
  Extend the lifecycle state with `checking`, `installing`, `blocked`, `error`, `updating`, and `unavailable`; expose `checkForUpdate`, `activateUpdate`, and `updateAvailable`.
- [x] **Step 2: Validate identities**
  Require valid SHA identities before comparing builds, registering a deployed worker, or exposing an update action. Invalid identities produce `unavailable` without worker registration.
- [x] **Step 3: Extract the version check**
  Make the existing no-store `/api/version` request callable from initial load, foreground return, and manual refresh. Call `registration.update()` when a registration exists and deduplicate concurrent checks.
- [x] **Step 4: Handle installing and waiting states**
  Report `available` while staging, `installing` while the target worker installs, and `ready` only when the exact deployed build is waiting.
- [x] **Step 5: Make activation retryable**
  If no matching waiting worker exists, trigger a fresh check instead of returning silently. On `UPDATE_ACTIVATION_BLOCKED`, clear the handoff flag and expose `blocked`; reload exactly once after a successful controller change.
- [x] **Step 6: Add tests for transitions**
  Cover invalid identities, manual checks, registration updates, installing/ready transitions, blocked activation, retry behavior, and existing cache/session behavior.

### Task 3: Build the shared status row and avatar notification

**Files:**
- Modify: `apps/web/components/shared/sidebar/SidebarVersion.tsx`
- Modify: `apps/web/components/dashboard/header/ProfileOptions.tsx`
- Modify: `apps/web/lib/i18n/locales/en/profile_menu.json`
- Test: `apps/web/components/shared/sidebar/SidebarVersion.test.tsx`
- Test: `apps/web/components/dashboard/header/ProfileOptions.test.tsx`

- [x] **Step 1: Render the horizontal build row**
  Use `justify-between` with the left side as `Build <short SHA>` plus `GitBranch`, and the right side as lifecycle status plus `RefreshCw` or `Download`.
- [x] **Step 2: Style status actions**
  Match build text size and muted styling for passive states. Use a compact emerald-tinted button with darker green text for `Update now`.
- [x] **Step 3: Add the profile avatar dot**
  Consume `updateAvailable` and render a small emerald dot at the avatar bottom-right without changing avatar dimensions.
- [x] **Step 4: Add copy and tests**
  Add translations for `Up to date`, `Checking...`, `Preparing update...`, `Update now`, `Updating...`, `Close other tabs to update`, `Check failed`, and `Update unavailable`; test each state and click action.

### Task 4: Validate and document

**Files:**
- Modify: `docs/superpowers/specs/2026-08-16-pwa-version-updates-design.md`
- Modify: `docs/superpowers/plans/2026-08-16-pwa-version-updates.md`
- Modify: `CONTEXT.md`

- [x] **Step 1: Run focused validation**
  ```bash
  pnpm --filter @karakeep/web test --run components/pwa/ServiceWorkerRegistration.test.tsx components/pwa/ServiceWorkerRegistration.readiness.test.tsx components/pwa/sw.test.ts components/shared/sidebar/SidebarVersion.test.tsx components/dashboard/header/ProfileOptions.test.tsx
  pnpm --filter @karakeep/web typecheck
  pnpm --filter @karakeep/web lint
  pnpm --filter @karakeep/web format
  ```
- [x] **Step 2: Validate production identity wiring**
  Verify the Dockerfile has the build argument in the builder stage before `next build`; do not run a full image build unless required by CI or explicitly requested.
- [x] **Step 3: Record completion**

Validation completed on 2026-08-21 in `.worktrees/manual-update`:

- Focused PWA and profile suites: 6 files, 30 tests passed.
- Full web suite: 42 files, 187 tests passed.
- Web typecheck and lint passed with zero errors and warnings.
- `git diff --check` passed.
