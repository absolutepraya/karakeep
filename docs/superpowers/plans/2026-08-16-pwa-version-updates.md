# PWA Version Visibility and Safe Auto-Update Implementation Plan

**Date:** 2026-08-16  
**Status:** Implemented on `feat/pwa-version-updates`; final validation in progress  
**Design:** `docs/superpowers/specs/2026-08-16-pwa-version-updates-design.md`

## Goal

Make installed PWAs expose the frontend build they are actually running, discover newer deployed builds automatically, stage the matching service worker without interrupting the active session, and hand off safely on a later fresh load.

The same change removes upstream-oriented profile actions, removes the social row, and presents Marka-owned future features as disabled `Coming soon` rows.

## Guardrails

- The running frontend build and the live deployed server build are separate identities.
- Update discovery must never replace the document that discovered the update.
- A pre-existing waiting worker may activate only when the requesting document is the sole relevant window client.
- Multiple open tabs or installed-PWA windows must block forced takeover.
- API and RSC requests remain network-only in the worker.
- Logout cache clearing, document-cache session scoping, thumbnail tracking, IndexedDB ownership, and offline mutation state remain unchanged.
- No update modal, toast, prompt, or manual `Update now` button.
- Native Expo and browser-extension update behavior remain out of scope.

## Final implementation shape

### Client lifecycle provider

`apps/web/components/pwa/ServiceWorkerRegistration.tsx` remains the service worker integration point and now also provides shared PWA lifecycle state.

It exports:

```ts
export type PwaUpdateStatus = "current" | "available" | "ready";

export interface PwaLifecycleState {
  appBuild: string;
  deployedBuild: string | null;
  updateStatus: PwaUpdateStatus;
}

export function usePwaLifecycle(): PwaLifecycleState;
```

The provider is mounted around the authenticated app subtree from `apps/web/lib/providers.tsx`.

### Build identity

- `appBuild` comes from `NEXT_PUBLIC_SERVICE_WORKER_BUILD_VERSION`, which is compiled into the running frontend.
- `deployedBuild` comes from same-origin `GET /api/version`.
- A differing deployed build is never presented as the currently running build.

### Update discovery

On mount and when the document becomes visible:

1. Request `/api/version` with `cache: "no-store"`.
2. Bound the request with an `AbortController` timeout so a hung request cannot permanently block later foreground checks.
3. Validate the returned deployed build as a Git SHA before using it in a service-worker URL.
4. If it differs from `appBuild`, register `/sw.js?v=<deployedBuild>` with scope `/` and `updateViaCache: "none"`.
5. Report `available` while the target worker is not waiting and `ready` once that exact target build is waiting.

Only one update check runs at a time. After success, failure, or timeout, the in-flight guard clears so a later lifecycle trigger may retry.

When an installing worker is observed, the provider attaches a state-change handler and immediately re-checks the worker's current state and registration. This closes the race where installation can finish before the handler is attached, ensuring an already-installed matching waiting worker is reported as `ready`.

### Fresh-load handoff

Before new update discovery starts, the provider inspects the existing registration.

- If a waiting worker already exists and its script URL matches `appBuild`, the current document may request `ACTIVATE_UPDATE`.
- A stale waiting or installing worker must not receive activation and must not suppress registration of the running app build.
- A worker that becomes waiting because the current document discovered it is not force-activated in that same document.

An armed `controllerchange` reloads the document exactly once. Ordinary first-registration controller changes do not reload.

### Worker safety

`apps/web/public/sw.js` handles `ACTIVATE_UPDATE`.

Before calling `skipWaiting()`, it calls `clients.matchAll({ type: "window", includeUncontrolled: true })` and rejects forced activation when another relevant window client exists. When blocked, it reports `UPDATE_ACTIVATION_BLOCKED` to the requester and leaves the worker waiting.

The existing activation path continues to remove stale versioned shell caches and call `clients.claim()`.

### Shared UI

`apps/web/components/shared/sidebar/SidebarVersion.tsx` consumes `usePwaLifecycle()`.

Desktop keeps the existing sidebar location. Mobile reuses the same presentation at the bottom of the profile dropdown through `placement="profile"`.

Normal state:

```text
absolutepraya/karakeep
Build abc1234
```

Deployed build differs:

```text
Build abc1234
Update available · def5678
```

Exact newer worker is waiting:

```text
Build abc1234
Update ready · def5678
```

Valid running-build SHAs link to the matching commit in `absolutepraya/karakeep`. Non-SHA values such as `development` render as plain build text without a commit link.

### Profile cleanup

`apps/web/components/dashboard/header/ProfileOptions.tsx`:

- removes the upstream social/X row entirely;
- removes upstream apps and documentation URLs;
- renders disabled `Apps & extensions` and `Documentation` rows;
- shows `Coming soon` for both;
- adds the version footer only on mobile with `sm:hidden`.

### Typed i18n namespace

The profile/build strings live in:

```text
apps/web/lib/i18n/locales/en/profile_menu.json
```

`apps/web/@types/i18next.d.ts` registers `profile_menu` as a typed namespace for the client UI. The client keeps the native `react-i18next` `useTranslation` export. The server helper remains intentionally scoped to the configured `defaultNS` (`translation`), matching every current server call site; server code does not opt into `profile_menu`.

This preserves the existing server translation contract and prevents the additional client namespace from widening unrelated server `TFunction` types to `translation | profile_menu`.

## Files

### Runtime

- `apps/web/components/pwa/ServiceWorkerRegistration.tsx`
- `apps/web/public/sw.js`
- `apps/web/lib/providers.tsx`
- `apps/web/components/shared/sidebar/SidebarVersion.tsx`
- `apps/web/components/shared/sidebar/Sidebar.tsx`
- `apps/web/components/dashboard/header/ProfileOptions.tsx`
- `apps/web/lib/i18n/client.ts`
- `apps/web/lib/i18n/server.ts`
- `apps/web/@types/i18next.d.ts`
- `apps/web/lib/i18n/locales/en/profile_menu.json`

### Tests

- `apps/web/components/pwa/ServiceWorkerRegistration.test.tsx`
- `apps/web/components/pwa/ServiceWorkerRegistration.timeout.test.tsx`
- `apps/web/components/pwa/ServiceWorkerRegistration.readiness.test.tsx`
- `apps/web/components/pwa/sw.test.ts`
- `apps/web/components/shared/sidebar/SidebarVersion.test.tsx`
- `apps/web/components/dashboard/header/ProfileOptions.test.tsx`
- existing header and web regressions as applicable

### Documentation

- `docs/superpowers/specs/2026-08-16-pwa-version-updates-design.md`
- `docs/superpowers/specs/2026-07-12-offline-library-pwa-design.md`
- this implementation plan

## Verification checklist

### Lifecycle behavior

- [x] Registers the running app worker with scope `/` and `updateViaCache: "none"`.
- [x] Preserves authenticated document-cache session synchronization.
- [x] Preserves unauthenticated private-cache clearing.
- [x] Preserves thumbnail-use message handling.
- [x] Checks `/api/version` on initial mount.
- [x] Checks `/api/version` again when the document returns to the foreground.
- [x] Uses `cache: "no-store"`.
- [x] Bounds hung version requests and permits later retries.
- [x] Deduplicates concurrent checks.
- [x] Registers the exact deployed-build worker URL when the server is newer.
- [x] Distinguishes available from ready using the exact worker build.
- [x] Detects readiness when the target worker finishes before the state listener is attached.
- [x] Does not activate a worker that became waiting during the discovering document.
- [x] Rejects stale waiting-worker activation.
- [x] Reloads exactly once only for an explicitly armed handoff.

### Worker safety

- [x] `ACTIVATE_UPDATE` is supported.
- [x] Sole-client activation may call `skipWaiting()`.
- [x] Another window client blocks force-activation.
- [x] Blocked activation reports back to the requester.
- [x] Existing versioned cache cleanup remains intact.
- [x] Existing user-cache clearing remains intact.

### UI

- [x] Desktop shows the running frontend build, not a substituted server build.
- [x] Desktop surfaces the newer deployed build separately.
- [x] Mobile profile footer shows the same lifecycle truth.
- [x] Running-build SHA links to the fork commit.
- [x] Non-SHA running builds render without a commit link.
- [x] Upstream apps URL is absent.
- [x] Upstream docs URL is absent.
- [x] Upstream social/X row is absent.
- [x] Apps & extensions is disabled and marked Coming soon.
- [x] Documentation is disabled and marked Coming soon.
- [x] New profile/build strings use the typed `profile_menu` namespace.

### Automated validation

Run focused web tests:

```bash
pnpm --filter @karakeep/web test --run \
  components/pwa/ServiceWorkerRegistration.test.tsx \
  components/pwa/ServiceWorkerRegistration.timeout.test.tsx \
  components/pwa/ServiceWorkerRegistration.readiness.test.tsx \
  components/pwa/sw.test.ts \
  components/shared/sidebar/SidebarVersion.test.tsx \
  components/dashboard/header/ProfileOptions.test.tsx \
  components/dashboard/header/Header.test.tsx
```

Run the full web suite:

```bash
pnpm --filter @karakeep/web test --run
```

Run repository validation required by current `AGENTS.md`:

```bash
pnpm format:fix
pnpm lint
pnpm typecheck
pnpm test
```

Use CI as the final source of truth for the pushed branch. Inspect actual failed job logs and fix root causes rather than rerunning blindly.

### Main synchronization

Before final status:

1. Re-read current `main`.
2. Compare `feat/pwa-version-updates` against it.
3. If the branch is behind, sync without destructive history rewriting.
4. Re-run relevant validation after resolving any conflicts.

### Review cleanup

- Resolve valid correctness, security, lifecycle, accessibility, and maintainability findings.
- Resolve stale findings only after verifying the referenced code is gone or the finding no longer applies.
- Remove all temporary diagnostic workflows before final validation.

## Real-device acceptance

Automated checks do not replace installed-PWA acceptance.

Before calling the feature fully device-verified, record these scenarios on both a Safari-installed iPhone PWA and an Android installed PWA:

1. Open build A and confirm the UI reports build A.
2. Deploy build B while A remains open.
3. Foreground A and confirm B is discovered without reloading A.
4. Confirm `Update ready · B` after the target worker waits.
5. Fully close/reopen, or refresh a sole remaining client, and confirm build B runs.
6. Keep another client open and confirm a refresh does not force that client under the new worker.
7. Repeat a version check offline and confirm the current app remains usable.

If these device checks have not been performed, the PR description must say they are pending rather than claiming full mobile acceptance.

## Out of scope

- Expo OTA/native app versioning.
- Browser-extension update behavior.
- Release notes or changelog UX.
- Manual update controls.
- User-selectable update channels.
- Client-side rollback.
- Hidden-document polling.
- Deployment or Watchtower changes.
- Replacing commit identifiers with semantic versions.
