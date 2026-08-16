# PWA Version Visibility and Safe Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the frontend commit actually running in the installed PWA and automatically install newly deployed web builds while delaying activation until a safe later load, with matching desktop/mobile version UI and Marka-owned profile placeholders.

**Architecture:** Expand `ServiceWorkerRegistration.tsx` into the app-shell lifecycle provider instead of introducing a second service-worker owner. The provider keeps the existing auth/cache messages, tracks `appBuild` versus live `/api/version`, registers a versioned worker for a newer commit, and only arms a reload when a worker was already waiting before the current document started update discovery. The worker itself decides whether `ACTIVATE_UPDATE` is safe by checking other window clients before calling `skipWaiting()`.

**Tech Stack:** Next.js App Router, React, TypeScript, Service Worker API, Vitest, Testing Library, i18next, Tailwind CSS.

## Global Constraints

- The running frontend build and currently deployed server build are separate identities.
- Check for newer builds on initial load and when the document returns to the foreground.
- Download/install a newer worker silently, but never reload merely because that update was discovered in the current document.
- A running session must not be replaced mid-edit.
- Do not show an update modal, toast, confirmation prompt, or manual `Update now` button.
- Do not force activation while another relevant window client remains open.
- Keep worker scope `/`, API/RSC network-only routing, logout cache clearing, offline-library ownership rules, and IndexedDB contents intact.
- Mobile version information belongs in the profile dropdown footer; desktop keeps the sidebar version area.
- Remove the upstream social row. Replace upstream apps/docs links with disabled Marka `Coming soon` rows.
- New visible web strings use the existing i18n system.
- Native Expo app updates, extension updates, semantic versioning, release notes, update channels, and deployment-model changes are out of scope.

---

## File Structure

- `apps/web/components/pwa/ServiceWorkerRegistration.tsx`: becomes the single React owner for service-worker registration, build discovery, update state, safe handoff arming, auth-cache messages, and the `usePwaLifecycle()` context.
- `apps/web/components/pwa/ServiceWorkerRegistration.test.tsx`: regression coverage for update discovery, foreground checks, waiting-worker rules, controller handoff, and existing auth/cache behavior.
- `apps/web/public/sw.js`: adds the safe `ACTIVATE_UPDATE` message path and blocked-activation reply without changing existing cache routing.
- `apps/web/components/pwa/sw.test.ts`: VM-level worker tests for sole-client activation and multi-client refusal.
- `apps/web/lib/providers.tsx`: wraps the application subtree with the lifecycle provider so sidebar/profile consumers share one source of truth.
- `apps/web/components/shared/sidebar/SidebarVersion.tsx`: renders the running app build plus deployed-update status from lifecycle context; supports sidebar and mobile-profile layouts.
- `apps/web/components/shared/sidebar/Sidebar.tsx`: stops passing server config as though it were the browser build.
- `apps/web/components/dashboard/header/ProfileOptions.tsx`: removes upstream/social links, adds disabled Marka future-feature rows, and shows the mobile build footer.
- `apps/web/components/dashboard/header/ProfileOptions.test.tsx`: validates disabled placeholders, absence of upstream/social URLs, and the mobile build footer.
- `apps/web/lib/i18n/locales/en/translation.json`: adds typed fallback strings for profile future features and build/update labels.
- `docs/superpowers/specs/2026-07-12-offline-library-pwa-design.md`: points app-shell lifecycle wording at the dedicated version/update design without changing offline-library behavior.

---

### Task 1: Build lifecycle provider and update discovery

**Files:**
- Modify: `apps/web/components/pwa/ServiceWorkerRegistration.tsx`
- Modify: `apps/web/components/pwa/ServiceWorkerRegistration.test.tsx`
- Modify: `apps/web/lib/providers.tsx`

**Interfaces:**
- Produces:
  - `type PwaUpdateStatus = "current" | "available" | "ready"`
  - `interface PwaLifecycleState { appBuild: string; deployedBuild: string | null; updateStatus: PwaUpdateStatus }`
  - `function usePwaLifecycle(): PwaLifecycleState`
  - default provider component accepting `{ children: React.ReactNode }`
- Consumes:
  - `process.env.NEXT_PUBLIC_SERVICE_WORKER_BUILD_VERSION`
  - `GET /api/version` returning `{ version: string }`
  - `navigator.serviceWorker.getRegistration("/")`
  - `navigator.serviceWorker.register(url, { scope: "/", updateViaCache: "none" })`

- [ ] **Step 1: Expand the test harness and write failing lifecycle tests**

Add registration objects with `installing`, `waiting`, `active`, and worker `statechange` listeners; mock `global.fetch`; mock `window.location.reload`; expose `document.visibilityState`. Cover these concrete contracts:

```tsx
it("fetches the live build without cache and registers a newer versioned worker", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ version: "bbbbbbb" }), {
      headers: { "content-type": "application/json" },
    }),
  );

  render(<ServiceWorkerRegistration><div /></ServiceWorkerRegistration>);

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith("/api/version", { cache: "no-store" }),
  );
  await waitFor(() =>
    expect(register).toHaveBeenCalledWith("/sw.js?v=bbbbbbb", {
      scope: "/",
      updateViaCache: "none",
    }),
  );
});
```

Also add tests that:

```text
- an identical deployed build stays current;
- a malformed/non-SHA deployed value is ignored for worker targeting;
- visibilitychange -> visible performs another no-store version check;
- simultaneous checks are deduplicated;
- an installing target reports available, then ready when it becomes waiting;
- a worker that becomes waiting during this document is NOT sent ACTIVATE_UPDATE;
- a worker already waiting before provider mount IS sent ACTIVATE_UPDATE;
- controllerchange reloads exactly once only after the provider armed a handoff;
- an ordinary first-registration controllerchange does not reload;
- fetch/register failures leave the app mounted and usable;
- the existing CLEAR_USER_CACHES, SET_DOCUMENT_CACHE_SESSION, and THUMBNAIL_USED behavior still passes.
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
mise exec -- pnpm --filter @karakeep/web test --run components/pwa/ServiceWorkerRegistration.test.tsx
```

Expected: FAIL because the current component returns `null`, has no lifecycle context, never fetches `/api/version`, and never performs safe activation handoff logic.

- [ ] **Step 3: Implement the lifecycle context and provider**

Use the existing file rather than creating a second service-worker owner. The public shape is:

```tsx
export type PwaUpdateStatus = "current" | "available" | "ready";

export interface PwaLifecycleState {
  appBuild: string;
  deployedBuild: string | null;
  updateStatus: PwaUpdateStatus;
}

const PwaLifecycleContext = createContext<PwaLifecycleState>({
  appBuild: serviceWorkerBuildVersion ?? "development",
  deployedBuild: null,
  updateStatus: "current",
});

export function usePwaLifecycle() {
  return useContext(PwaLifecycleContext);
}
```

Validate deployment targets with the fork's commit format:

```ts
function isDeployBuild(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value);
}
```

On mount, call `getRegistration("/")` before starting new update discovery. If `registration?.waiting` already exists, set a handoff-armed ref and send:

```ts
registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
```

Register the current app worker if needed using:

```ts
const workerUrl = appBuild === "development"
  ? "/sw.js"
  : `/sw.js?v=${encodeURIComponent(appBuild)}`;
```

Create one deduplicated `checkForUpdate()` promise/ref that:

```ts
const response = await fetch("/api/version", { cache: "no-store" });
const body = (await response.json()) as { version?: unknown };
if (!isDeployBuild(body.version) || body.version === appBuild) return;
setDeployedBuild(body.version);
setUpdateStatus("available");
const registration = await navigator.serviceWorker.register(
  `/sw.js?v=${encodeURIComponent(body.version)}`,
  { scope: "/", updateViaCache: "none" },
);
```

Observe `registration.waiting` immediately and `registration.installing.statechange`; when the target reaches `installed` and a waiting worker exists, set `updateStatus` to `"ready"`. Do not send `ACTIVATE_UPDATE` to a worker that became waiting from this check.

Add `visibilitychange` and run `checkForUpdate()` only when `document.visibilityState === "visible"`.

Keep the existing message/session/cache methods inside the same provider. For `controllerchange`, reload only when the explicit handoff-armed ref is true and a session-storage loop guard is not set for this navigation. Clear/consume the guard so unrelated future controller changes do not loop.

Return:

```tsx
return (
  <PwaLifecycleContext.Provider value={{ appBuild, deployedBuild, updateStatus }}>
    {children}
  </PwaLifecycleContext.Provider>
);
```

- [ ] **Step 4: Wrap the application subtree with the provider**

In `apps/web/lib/providers.tsx`, change the current standalone registration node into the owner of the rest of the app providers:

```tsx
<SessionProvider session={session}>
  <ServiceWorkerRegistration>
    <QueryClientProvider client={queryClient}>
      {/* existing TRPC / offline-library / i18n / theme subtree unchanged */}
    </QueryClientProvider>
  </ServiceWorkerRegistration>
</SessionProvider>
```

- [ ] **Step 5: Run the focused lifecycle test**

Run:

```bash
mise exec -- pnpm --filter @karakeep/web test --run components/pwa/ServiceWorkerRegistration.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/pwa/ServiceWorkerRegistration.tsx apps/web/components/pwa/ServiceWorkerRegistration.test.tsx apps/web/lib/providers.tsx
git commit -m "feat: add PWA build update lifecycle"
```

---

### Task 2: Safe service-worker activation protocol

**Files:**
- Modify: `apps/web/public/sw.js`
- Modify: `apps/web/components/pwa/sw.test.ts`

**Interfaces:**
- Consumes client message: `{ type: "ACTIVATE_UPDATE" }`
- Produces blocked reply: `{ type: "UPDATE_ACTIVATION_BLOCKED" }`
- Preserves existing messages: `CLEAR_USER_CACHES`, `SET_DOCUMENT_CACHE_SESSION`, `THUMBNAIL_USED`

- [ ] **Step 1: Write failing worker tests for activation safety**

Extend the worker harness with:

```ts
const clients = {
  claim: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(undefined),
  matchAll: vi.fn().mockResolvedValue([]),
};
```

Add these tests:

```ts
it("activates a waiting update when the requester is the only window client", async () => {
  const worker = createWorkerHarness();
  worker.clients.matchAll.mockResolvedValue([{ id: "client-1" }]);

  const dispatched = await worker.dispatch("message", {
    data: { type: "ACTIVATE_UPDATE" },
    source: { id: "client-1", postMessage: vi.fn() },
  });
  await Promise.all(dispatched.work);

  expect(worker.self.skipWaiting).toHaveBeenCalledOnce();
});
```

```ts
it("refuses force activation while another window client remains", async () => {
  const worker = createWorkerHarness();
  const postMessage = vi.fn();
  worker.clients.matchAll.mockResolvedValue([
    { id: "client-1" },
    { id: "client-2" },
  ]);

  const dispatched = await worker.dispatch("message", {
    data: { type: "ACTIVATE_UPDATE" },
    source: { id: "client-1", postMessage },
  });
  await Promise.all(dispatched.work);

  expect(worker.self.skipWaiting).not.toHaveBeenCalled();
  expect(postMessage).toHaveBeenCalledWith({ type: "UPDATE_ACTIVATION_BLOCKED" });
});
```

- [ ] **Step 2: Run the worker test and verify failure**

Run:

```bash
mise exec -- pnpm --filter @karakeep/web test --run components/pwa/sw.test.ts
```

Expected: FAIL because `ACTIVATE_UPDATE` is not handled.

- [ ] **Step 3: Implement the safe activation message path**

Handle `ACTIVATE_UPDATE` before the existing cache-clear branch:

```js
if (event.data?.type === "ACTIVATE_UPDATE") {
  event.waitUntil(handleActivateUpdate(event));
  return;
}
```

Add:

```js
async function handleActivateUpdate(event) {
  const requesterId = event.source?.id;
  if (typeof requesterId !== "string") return;

  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const safe =
    windowClients.length === 1 && windowClients[0]?.id === requesterId;

  if (!safe) {
    event.source?.postMessage?.({ type: "UPDATE_ACTIVATION_BLOCKED" });
    return;
  }

  await self.skipWaiting();
}
```

Do not change `activate`, cache naming, navigation routing, thumbnail routing, or logout purge behavior.

- [ ] **Step 4: Run worker tests**

Run:

```bash
mise exec -- pnpm --filter @karakeep/web test --run components/pwa/sw.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/public/sw.js apps/web/components/pwa/sw.test.ts
git commit -m "feat: activate PWA updates only when safe"
```

---

### Task 3: Shared build UI, mobile profile footer, and Marka future features

**Files:**
- Modify: `apps/web/components/shared/sidebar/SidebarVersion.tsx`
- Modify: `apps/web/components/shared/sidebar/Sidebar.tsx`
- Modify: `apps/web/components/dashboard/header/ProfileOptions.tsx`
- Create: `apps/web/components/dashboard/header/ProfileOptions.test.tsx`
- Modify: `apps/web/lib/i18n/locales/en/translation.json`

**Interfaces:**
- Consumes: `usePwaLifecycle()` from Task 1
- Produces: `SidebarVersion({ placement?: "sidebar" | "profile" })`

- [ ] **Step 1: Write failing UI tests**

Create `ProfileOptions.test.tsx` with mocks for session, router, user profile, theme, and translations. Assert the rendered menu:

```text
- contains Apps & extensions and Documentation;
- contains Coming soon for both;
- does not contain hrefs to karakeep.app/apps, docs.karakeep.app, or x.com/karakeep_app;
- does not render an X/social row;
- renders the profile build footer inside an sm:hidden wrapper;
```

Extend or add a focused test for `SidebarVersion` that mocks `usePwaLifecycle()` as:

```ts
{
  appBuild: "aaaaaaa",
  deployedBuild: "bbbbbbb",
  updateStatus: "ready",
}
```

and expects `Build aaaaaaa` plus `Update ready · bbbbbbb`, with the running SHA linked to:

```text
https://github.com/absolutepraya/karakeep/commit/aaaaaaa
```

- [ ] **Step 2: Run focused UI tests and verify failure**

Run:

```bash
mise exec -- pnpm --filter @karakeep/web test --run \
  components/dashboard/header/ProfileOptions.test.tsx \
  components/shared/sidebar/SidebarVersion.test.tsx
```

Expected: FAIL because the profile still has upstream/social links and `SidebarVersion` still receives server build props.

- [ ] **Step 3: Add typed English fallback strings**

Add a top-level `profile_menu` section in `apps/web/lib/i18n/locales/en/translation.json`:

```json
"profile_menu": {
  "apps_extensions": "Apps & extensions",
  "documentation": "Documentation",
  "coming_soon": "Coming soon",
  "build": "Build {{build}}",
  "update_available": "Update available · {{build}}",
  "update_ready": "Update ready · {{build}}"
}
```

Other locales may use the existing English fallback until translated; do not hard-code the new labels in JSX.

- [ ] **Step 4: Refactor `SidebarVersion` to lifecycle truth**

Keep the existing fork repository constants and SHA validation. Replace `serverVersion`/`changeLogVersion` props with:

```ts
interface SidebarVersionProps {
  placement?: "sidebar" | "profile";
}
```

Read:

```ts
const { appBuild, deployedBuild, updateStatus } = usePwaLifecycle();
```

Render the running `appBuild` as the primary build. When `deployedBuild` differs, render exactly one secondary line:

```tsx
{updateStatus === "ready"
  ? t("profile_menu.update_ready", { build: deployedBuild.slice(0, 7) })
  : t("profile_menu.update_available", { build: deployedBuild.slice(0, 7) })}
```

Use `placement` only for spacing/border differences. Keep repo/build links and monospace build styling.

- [ ] **Step 5: Stop the server sidebar from substituting server build identity**

In `Sidebar.tsx`, remove the `serverConfig` import and render:

```tsx
<SidebarVersion />
```

instead of passing `serverConfig.serverVersion`.

- [ ] **Step 6: Replace upstream profile actions and add mobile footer**

In `ProfileOptions.tsx`:

- remove the `Twitter` import;
- remove all three upstream `<a>` rows;
- render two disabled menu rows with `Puzzle` and `BookOpen`, each showing the translated feature name and `Coming soon` secondary/trailing text;
- use disabled semantics (`disabled` on `DropdownMenuItem`) and no `href`;
- after a separator near the bottom, add:

```tsx
<div className="sm:hidden">
  <SidebarVersion placement="profile" />
</div>
```

Keep sign-out as the final actionable row.

- [ ] **Step 7: Run focused UI tests**

Run:

```bash
mise exec -- pnpm --filter @karakeep/web test --run \
  components/dashboard/header/ProfileOptions.test.tsx \
  components/shared/sidebar/SidebarVersion.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add \
  apps/web/components/shared/sidebar/SidebarVersion.tsx \
  apps/web/components/shared/sidebar/SidebarVersion.test.tsx \
  apps/web/components/shared/sidebar/Sidebar.tsx \
  apps/web/components/dashboard/header/ProfileOptions.tsx \
  apps/web/components/dashboard/header/ProfileOptions.test.tsx \
  apps/web/lib/i18n/locales/en/translation.json
git commit -m "feat: surface PWA build state on mobile"
```

---

### Task 4: Align PWA documentation and run web validation

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-offline-library-pwa-design.md`

**Interfaces:**
- Consumes the approved lifecycle design at `docs/superpowers/specs/2026-08-16-pwa-version-updates-design.md`.

- [ ] **Step 1: Update the prior app-shell lifecycle wording**

Keep the existing product rule but make the implementation ownership explicit. Replace the isolated lifecycle sentence with wording equivalent to:

```markdown
App-shell update discovery, version visibility, and safe activation follow
[PWA Version Visibility and Safe Auto-Update Design](2026-08-16-pwa-version-updates-design.md).
A running app is never replaced merely because a newer worker downloads; a waiting build takes over on a later safe load or after old clients close.
```

Do not alter offline replica, mutation, conflict, or synchronization behavior.

- [ ] **Step 2: Run focused PWA/UI tests together**

Run:

```bash
mise exec -- pnpm --filter @karakeep/web test --run \
  components/pwa/ServiceWorkerRegistration.test.tsx \
  components/pwa/sw.test.ts \
  components/dashboard/header/ProfileOptions.test.tsx \
  components/shared/sidebar/SidebarVersion.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run web-package tests**

Run:

```bash
mise exec -- pnpm --filter @karakeep/web test --run
```

Expected: PASS.

- [ ] **Step 4: Run repository-required static validation**

Run:

```bash
mise exec -- pnpm format:fix
mise exec -- pnpm lint
mise exec -- pnpm typecheck
```

Expected: all commands PASS after formatting changes are committed.

- [ ] **Step 5: Commit documentation/format-only adjustments**

```bash
git add docs/superpowers/specs/2026-07-12-offline-library-pwa-design.md apps/web
git commit -m "docs: align offline PWA update lifecycle"
```

---

### Task 5: PR, CI, review, and merge-ready verification

**Files:**
- No new product files unless CI/review finds a valid issue.

- [ ] **Step 1: Re-check `main` before opening/finalizing the PR**

Compare `feat/pwa-version-updates` with the latest `main`. If behind, update the feature branch with the intended base without rewriting shared history, resolve conflicts semantically, and rerun Task 4 validation.

- [ ] **Step 2: Open a non-draft PR**

Use a description that includes:

```markdown
## Problem
Installed PWAs can keep running an old frontend build without clearly showing it, and the current versioned worker URL prevents an old bundle from discovering a newly deployed worker URL by `registration.update()` alone.

## Solution
- expose running app build vs deployed build through one PWA lifecycle provider
- check `/api/version` on load and foreground
- silently install the deployed worker
- activate only on a later safe load / sole-client handoff
- show build/update state in desktop sidebar and mobile profile
- replace upstream profile links with Marka `Coming soon` rows and remove socials

## Validation
- focused service-worker/provider/UI tests
- full `@karakeep/web` tests
- format, lint, typecheck

## Device follow-up
Real Safari-installed iPhone and Android-installed PWA acceptance remains required and should be recorded before calling the feature fully device-verified.
```

- [ ] **Step 3: Inspect actual CI jobs/logs**

Do not infer failures from check names. For every failing job, fetch the job/log, classify the failure as regression, stale test, formatting/type/lint, flaky infrastructure, or unrelated base failure, then fix the root cause and push a new commit.

- [ ] **Step 4: Inspect automated/human review findings**

Verify every CodeRabbit or other reviewer finding against the current code. Fix valid correctness/security/accessibility/lifecycle findings; reject stale/noisy suggestions without changing intended behavior.

- [ ] **Step 5: Final current-head verification**

Before calling the PR merge-ready:

```text
- branch is current with main;
- no temporary diagnostics remain;
- focused PWA/UI tests pass;
- full web tests pass;
- format/lint/typecheck pass;
- CI on the current head is green except explicitly identified external/infrastructure failures;
- review blockers are resolved;
- PR description matches the final implementation;
- real-device acceptance is clearly marked pending if it cannot be performed from this environment.
```
