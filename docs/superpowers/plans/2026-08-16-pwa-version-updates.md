# PWA Version Visibility and Safe Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the frontend commit actually running in the installed PWA and automatically install newly deployed web builds while delaying activation until a safe later load, with matching desktop/mobile version UI and Marka-owned profile placeholders.

**Architecture:** Expand `ServiceWorkerRegistration.tsx` into the single app-shell lifecycle provider. It preserves the existing auth/cache messaging, tracks `appBuild` versus live `/api/version`, registers the fork's existing versioned worker URL for a newer commit, and only arms a reload when a worker was already waiting before the current document started update discovery. The worker itself decides whether `ACTIVATE_UPDATE` is safe by checking same-origin window clients before calling `skipWaiting()`.

**Tech Stack:** Next.js App Router, React, TypeScript, Service Worker API, Vitest, Testing Library, i18next, Tailwind CSS.

## Global Constraints

- The running frontend build and currently deployed server build are separate identities.
- Check for newer builds on initial load and when the document returns to the foreground.
- Download/install a newer worker silently, but never reload merely because that update was discovered in the current document.
- A running session must not be replaced mid-edit.
- Do not show an update modal, toast, confirmation prompt, or manual `Update now` button.
- Do not force activation while another relevant window client remains open.
- Preserve the fork's existing `/sw.js?v=<build>` worker identity for this change; a stable worker-URL build-pipeline redesign is out of scope.
- Keep worker scope `/`, API/RSC network-only routing, logout cache clearing, offline-library ownership rules, and IndexedDB contents intact.
- Mobile version information belongs in the profile dropdown footer; desktop keeps the sidebar version area.
- Remove the upstream social row. Replace upstream apps/docs links with disabled Marka `Coming soon` rows.
- New visible web strings use the existing i18n system.
- Native Expo app updates, extension updates, semantic versioning, release notes, update channels, and deployment-model changes are out of scope.

---

## File Structure

- `apps/web/components/pwa/ServiceWorkerRegistration.tsx`: React owner for service-worker registration, build discovery, update state, safe handoff arming, auth-cache messages, and `usePwaLifecycle()`.
- `apps/web/components/pwa/ServiceWorkerRegistration.test.tsx`: lifecycle and existing auth/cache regression tests.
- `apps/web/public/sw.js`: safe `ACTIVATE_UPDATE` handling and blocked-activation reply.
- `apps/web/components/pwa/sw.test.ts`: VM-level worker activation safety tests.
- `apps/web/lib/providers.tsx`: wraps the app subtree with the lifecycle provider.
- `apps/web/components/shared/sidebar/SidebarVersion.tsx`: shared running-build/update presentation for desktop sidebar and mobile profile footer.
- `apps/web/components/shared/sidebar/SidebarVersion.test.tsx`: lifecycle-truth and commit-link presentation tests.
- `apps/web/components/shared/sidebar/Sidebar.tsx`: stops passing live server config as browser build identity.
- `apps/web/components/dashboard/header/ProfileOptions.tsx`: removes upstream/social links, adds disabled Marka future-feature rows, and adds the mobile build footer.
- `apps/web/components/dashboard/header/ProfileOptions.test.tsx`: profile menu regression coverage.
- `apps/web/lib/i18n/locales/en/translation.json`: typed English fallback strings for the new UI.
- `docs/superpowers/specs/2026-07-12-offline-library-pwa-design.md`: links the old app-shell statement to the dedicated lifecycle design.

---

### Task 1: Build lifecycle provider and update discovery

**Files:**
- Modify: `apps/web/components/pwa/ServiceWorkerRegistration.tsx`
- Modify: `apps/web/components/pwa/ServiceWorkerRegistration.test.tsx`
- Modify: `apps/web/lib/providers.tsx`

**Interfaces:**
- Produces `type PwaUpdateStatus = "current" | "available" | "ready"`.
- Produces `interface PwaLifecycleState { appBuild: string; deployedBuild: string | null; updateStatus: PwaUpdateStatus }`.
- Produces `function usePwaLifecycle(): PwaLifecycleState`.
- Default export becomes a provider accepting `{ children: React.ReactNode }`.
- Consumes `process.env.NEXT_PUBLIC_SERVICE_WORKER_BUILD_VERSION`, `GET /api/version`, `navigator.serviceWorker.getRegistration("/")`, and `navigator.serviceWorker.register()`.

- [ ] **Step 1: Write failing lifecycle tests**

Expand the existing jsdom harness with mocked `getRegistration`, richer registration objects (`installing`, `waiting`, `active`), worker `statechange`, `global.fetch`, `document.visibilityState`, and a reload spy. Add tests for:

```text
- initial live-version fetch uses fetch("/api/version", { cache: "no-store" });
- valid newer SHA registers /sw.js?v=<deployedBuild> with scope / and updateViaCache none;
- identical deployed build stays current;
- malformed/non-SHA deployed version is ignored for worker targeting;
- visible visibilitychange performs another live-version check;
- overlapping checks are deduplicated;
- installing target reports available and waiting target reports ready;
- a worker that becomes waiting during this document is never sent ACTIVATE_UPDATE;
- a worker already waiting before mount is sent ACTIVATE_UPDATE;
- controllerchange reloads once only when a handoff was explicitly armed;
- ordinary first-registration controllerchange does not reload;
- version/registration failures do not unmount or throw;
- CLEAR_USER_CACHES, SET_DOCUMENT_CACHE_SESSION, and THUMBNAIL_USED still work.
```

Use the existing unauthenticated test as a regression rather than replacing it.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
mise exec -- pnpm --filter @karakeep/web test --run components/pwa/ServiceWorkerRegistration.test.tsx
```

Expected: FAIL because the current component does not expose lifecycle state, fetch `/api/version`, or perform controlled activation.

- [ ] **Step 3: Implement lifecycle state and build validation**

In `ServiceWorkerRegistration.tsx`, define:

```tsx
export type PwaUpdateStatus = "current" | "available" | "ready";

export interface PwaLifecycleState {
  appBuild: string;
  deployedBuild: string | null;
  updateStatus: PwaUpdateStatus;
}

const serviceWorkerBuildVersion =
  process.env.NEXT_PUBLIC_SERVICE_WORKER_BUILD_VERSION ?? "development";

function isDeployBuild(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value);
}
```

Create a context defaulted to the compiled `serviceWorkerBuildVersion` and export:

```tsx
export function usePwaLifecycle() {
  return useContext(PwaLifecycleContext);
}
```

- [ ] **Step 4: Implement initial registration and pre-existing waiting-worker detection**

On mount, call `navigator.serviceWorker.getRegistration("/")` before starting new update discovery. If `existingRegistration?.waiting` exists, arm the handoff with refs and send:

```ts
existingRegistration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
```

Use the existing current-build URL rule:

```ts
const currentWorkerUrl =
  serviceWorkerBuildVersion === "development"
    ? "/sw.js"
    : `/sw.js?v=${encodeURIComponent(serviceWorkerBuildVersion)}`;
```

Register it with:

```ts
{ scope: "/", updateViaCache: "none" }
```

Keep existing active-worker/session-cache synchronization behavior.

- [ ] **Step 5: Implement deduplicated live-version discovery**

Use `const checkPromiseRef = useRef<Promise<void> | null>(null)`. `checkForUpdate()` returns the existing promise while one is running and clears the ref in `finally`.

The request path is exactly:

```ts
const response = await fetch("/api/version", { cache: "no-store" });
if (!response.ok) return;
const body = (await response.json()) as { version?: unknown };
if (!isDeployBuild(body.version)) return;
setDeployedBuild(body.version);
if (body.version === serviceWorkerBuildVersion) {
  setUpdateStatus("current");
  return;
}
setUpdateStatus("available");
```

Register the newer target with:

```ts
const registration = await navigator.serviceWorker.register(
  `/sw.js?v=${encodeURIComponent(body.version)}`,
  { scope: "/", updateViaCache: "none" },
);
```

If `registration.waiting` exists after registration, set `ready`. Otherwise observe `registration.installing` and set `ready` only after its `state` becomes `installed` and `registration.waiting` is present. Never send `ACTIVATE_UPDATE` from this newly discovered path.

- [ ] **Step 6: Add foreground checking and exact reload guard**

Register `visibilitychange`; when `document.visibilityState === "visible"`, call `checkForUpdate()`.

Use only per-document refs for the handoff guard:

```ts
const handoffArmedRef = useRef(false);
const handoffReloadedRef = useRef(false);
```

The `controllerchange` listener performs:

```ts
if (!handoffArmedRef.current || handoffReloadedRef.current) return;
handoffReloadedRef.current = true;
window.location.reload();
```

A newly loaded document starts with fresh refs, and no second reload occurs unless that new document independently finds a pre-existing waiting worker and arms a new handoff. Do not reload for ordinary controller changes.

- [ ] **Step 7: Convert the component into the context provider and wire providers**

Return:

```tsx
<PwaLifecycleContext.Provider
  value={{
    appBuild: serviceWorkerBuildVersion,
    deployedBuild,
    updateStatus,
  }}
>
  {children}
</PwaLifecycleContext.Provider>
```

In `apps/web/lib/providers.tsx`, replace the standalone `<ServiceWorkerRegistration />` with:

```tsx
<SessionProvider session={session}>
  <ServiceWorkerRegistration>
    <QueryClientProvider client={queryClient}>
      {/* existing TRPC/offline/i18n/theme subtree unchanged */}
    </QueryClientProvider>
  </ServiceWorkerRegistration>
</SessionProvider>
```

- [ ] **Step 8: Run the focused lifecycle test**

```bash
mise exec -- pnpm --filter @karakeep/web test --run components/pwa/ServiceWorkerRegistration.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

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
- Client to waiting worker: `{ type: "ACTIVATE_UPDATE" }`.
- Waiting worker blocked reply: `{ type: "UPDATE_ACTIVATION_BLOCKED" }`.
- Existing cache/session messages remain unchanged.

- [ ] **Step 1: Write failing worker activation tests**

Extend the harness with:

```ts
matchAll: vi.fn().mockResolvedValue([]),
```

and allow `WorkerEvent.source` to include `postMessage`.

Add:

```ts
it("activates when the requester is the only window client", async () => {
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

Add a second test with clients `client-1` and `client-2`; expect no `skipWaiting()` and expect the requester to receive `{ type: "UPDATE_ACTIVATION_BLOCKED" }`.

- [ ] **Step 2: Run the worker test and verify failure**

```bash
mise exec -- pnpm --filter @karakeep/web test --run components/pwa/sw.test.ts
```

Expected: FAIL because the worker has no `ACTIVATE_UPDATE` branch.

- [ ] **Step 3: Implement activation safety in `sw.js`**

Before the existing `CLEAR_USER_CACHES` branch:

```js
if (event.data?.type === "ACTIVATE_UPDATE") {
  event.waitUntil(handleActivateUpdate(event));
  return;
}
```

Implement exactly:

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

Do not alter install/activate cache behavior, navigation routing, thumbnail routing, or logout purge behavior.

- [ ] **Step 4: Run the worker test**

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

### Task 3: Shared version UI and profile cleanup

**Files:**
- Modify: `apps/web/components/shared/sidebar/SidebarVersion.tsx`
- Create: `apps/web/components/shared/sidebar/SidebarVersion.test.tsx`
- Modify: `apps/web/components/shared/sidebar/Sidebar.tsx`
- Modify: `apps/web/components/dashboard/header/ProfileOptions.tsx`
- Create: `apps/web/components/dashboard/header/ProfileOptions.test.tsx`
- Modify: `apps/web/lib/i18n/locales/en/translation.json`

**Interfaces:**
- Consumes `usePwaLifecycle()` from Task 1.
- Produces `SidebarVersion({ placement?: "sidebar" | "profile" })`.

- [ ] **Step 1: Write failing shared-version test**

Mock `usePwaLifecycle()` as:

```ts
{
  appBuild: "aaaaaaa",
  deployedBuild: "bbbbbbb",
  updateStatus: "ready",
}
```

Assert `Build aaaaaaa`, `Update ready · bbbbbbb`, repository text, and the running-build commit link:

```text
https://github.com/absolutepraya/karakeep/commit/aaaaaaa
```

Also test `available` renders `Update available · bbbbbbb` and `current` with no differing deployment renders no update line.

- [ ] **Step 2: Write failing profile test**

Mock session/router/user/theme/translations plus `SidebarVersion`. Render the profile menu and assert:

```text
- Apps & extensions appears;
- Documentation appears;
- Coming soon appears for both;
- no anchor href contains karakeep.app/apps;
- no anchor href contains docs.karakeep.app;
- no anchor href contains x.com/karakeep_app;
- no social/X row remains;
- the mobile version footer wrapper has class sm:hidden.
```

- [ ] **Step 3: Run the UI tests and verify failure**

```bash
mise exec -- pnpm --filter @karakeep/web test --run \
  components/shared/sidebar/SidebarVersion.test.tsx \
  components/dashboard/header/ProfileOptions.test.tsx
```

Expected: FAIL because the version component still receives server props and profile links still point upstream.

- [ ] **Step 4: Add typed English fallback strings**

Add top-level:

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

The i18n configuration already falls back to English, so other locale files do not need placeholder duplication in this focused change.

- [ ] **Step 5: Refactor `SidebarVersion` to browser lifecycle truth**

Keep the fork repository constants and SHA validation. Replace server-version props with:

```ts
interface SidebarVersionProps {
  placement?: "sidebar" | "profile";
}
```

Read lifecycle state:

```ts
const { appBuild, deployedBuild, updateStatus } = usePwaLifecycle();
```

The primary line must always use `appBuild`. If `deployedBuild` differs, show exactly one translated secondary line:

```tsx
{updateStatus === "ready"
  ? t("profile_menu.update_ready", { build: deployedBuild.slice(0, 7) })
  : t("profile_menu.update_available", { build: deployedBuild.slice(0, 7) })}
```

Use `placement` only for layout/border spacing. Preserve links to the fork repository and valid running-build SHA.

- [ ] **Step 6: Stop `Sidebar.tsx` from passing server build as app build**

Remove its `serverConfig` import and render:

```tsx
<SidebarVersion />
```

- [ ] **Step 7: Replace profile upstream rows and add mobile build footer**

In `ProfileOptions.tsx`:

```text
- remove the Twitter import and social row;
- remove upstream href rows for apps and docs;
- render disabled `DropdownMenuItem` rows with Puzzle and BookOpen icons;
- show translated Apps & extensions / Documentation with translated Coming soon secondary or trailing text;
- do not retain hidden hrefs;
- add a separator and `<div className="sm:hidden"><SidebarVersion placement="profile" /></div>` before the final sign-out section;
- keep sign-out actionable and last.
```

- [ ] **Step 8: Run the UI tests**

```bash
mise exec -- pnpm --filter @karakeep/web test --run \
  components/shared/sidebar/SidebarVersion.test.tsx \
  components/dashboard/header/ProfileOptions.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

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

### Task 4: Documentation and repository validation

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-offline-library-pwa-design.md`

- [ ] **Step 1: Align the prior PWA design**

Replace the standalone app-shell lifecycle statement with:

```markdown
App-shell update discovery, version visibility, and safe activation follow
[PWA Version Visibility and Safe Auto-Update Design](2026-08-16-pwa-version-updates-design.md).
A running app is never replaced merely because a newer worker downloads; a waiting build takes over on a later safe load or after old clients close.
```

Do not change offline replica, mutation, conflict, or synchronization contracts.

- [ ] **Step 2: Run all focused tests together**

```bash
mise exec -- pnpm --filter @karakeep/web test --run \
  components/pwa/ServiceWorkerRegistration.test.tsx \
  components/pwa/sw.test.ts \
  components/shared/sidebar/SidebarVersion.test.tsx \
  components/dashboard/header/ProfileOptions.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full web tests**

```bash
mise exec -- pnpm --filter @karakeep/web test --run
```

Expected: PASS.

- [ ] **Step 4: Run required static validation**

```bash
mise exec -- pnpm format:fix
mise exec -- pnpm lint
mise exec -- pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit documentation/format adjustments**

```bash
git add docs/superpowers/specs/2026-07-12-offline-library-pwa-design.md apps/web
git commit -m "docs: align offline PWA update lifecycle"
```

---

### Task 5: PR, CI, review, and merge-ready verification

- [ ] **Step 1: Re-check latest `main`**

Compare `feat/pwa-version-updates` with current `main`. If behind, update without rewriting shared history, resolve conflicts semantically, and rerun Task 4 validation.

- [ ] **Step 2: Open a non-draft PR**

Use a description containing:

```markdown
## Problem
Installed PWAs can keep running an old frontend build without clearly showing it, and the fork's versioned worker URL means an old bundle needs the live deployed build before it can register that newer worker URL.

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

For each failure, inspect the real job/log and classify it as regression, stale test, formatting/type/lint, flaky infrastructure, or unrelated base failure. Fix root causes rather than silencing checks.

- [ ] **Step 4: Inspect reviews**

Verify every CodeRabbit or other finding against current code. Fix valid correctness/security/accessibility/lifecycle findings and reject stale/noisy suggestions without changing intended product behavior.

- [ ] **Step 5: Final current-head verification**

Require all of:

```text
- branch current with main;
- no temporary diagnostics;
- focused PWA/UI tests pass;
- full web tests pass;
- format/lint/typecheck pass;
- current-head CI green except explicitly identified external infrastructure failures;
- valid review blockers resolved;
- PR description matches implementation;
- real-device acceptance clearly marked pending if it cannot be performed here.
```
