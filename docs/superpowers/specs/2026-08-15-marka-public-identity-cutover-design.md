# Marka Public Identity Cutover Design

**Status:** Approved design, implementation not started

**Primary issue:** #27

**Related issues:** #10, #11, #25, #26, #35

## Purpose

Complete the controlled external identity cutover from the current Karakeep-era public infrastructure names to **Marka**, while keeping the migration bounded to the actively operated public web/self-host surfaces.

This document is the authoritative design for #27. The executable task sequence lives in `docs/superpowers/plans/2026-08-15-marka-public-identity-cutover.md`. ADR `docs/adr/0001-marka-public-identity-cutover-boundary.md` records the durable boundary between public identity and deferred internal identifiers.

No external mutation is authorized merely by the existence of these documents. DNS, GitHub repository rename, GHCR publishing changes, production configuration, OAuth/auth settings, reverse proxy, and live redirects are implementation-stage actions and must follow the plan checkpoints.

## Confirmed target state

| Surface | Current identity | Target identity |
| --- | --- | --- |
| Product name | Marka already visible after Phase 1 | Marka |
| GitHub repository | `absolutepraya/karakeep` | `absolutepraya/marka` |
| Canonical app origin | `https://keep.abhipraya.dev` | `https://marka.abhipraya.dev` |
| Web image | `ghcr.io/absolutepraya/karakeep:web-main` | `ghcr.io/absolutepraya/marka:web-main` |
| Workers image | `ghcr.io/absolutepraya/karakeep:workers-main` | `ghcr.io/absolutepraya/marka:workers-main` |
| Legacy app hostname | Live application origin | Permanent redirect to Marka after verification |
| Legacy GitHub path | Active repository | GitHub-managed rename redirect only; never recreate the old repository name |
| Legacy GHCR package | Receives current releases | Frozen historical package; no new fork tags |

## Explicit boundary

### Included

- GitHub repository rename to `absolutepraya/marka`.
- Current-tree repository links, raw GitHub URLs, clone URLs, badges, repo-facing metadata, and active references controlled by this fork.
- GHCR image publishing hard switch to `ghcr.io/absolutepraya/marka`.
- Production Compose and Watchtower migration to the Marka GHCR package.
- Guided installer defaults and documentation that currently point at the fork's old GitHub/GHCR identities.
- `marka.abhipraya.dev` DNS/TLS/reverse-proxy/application-origin cutover.
- Auth/origin/callback/CORS/cookie/webhook/RSS/API behavior that depends on the public origin.
- Active web canonical/discovery metadata and generated public/share/RSS URLs.
- Legacy `keep.abhipraya.dev` permanent redirect after Marka is verified.
- Current GitHub repository-side presentation/settings that expose obsolete public identity.
- A pre-cutover backup stored on the local MacBook running the migration.
- An audit of browser extension/mobile/npm/SDK/MCP surfaces for coupling to changed values.

### Excluded

- Renaming `KARAKEEP_*` variables.
- Renaming `@karakeep/*` packages or package scopes.
- Renaming persisted data/config/cache paths.
- Renaming Compose services/project naming solely for branding.
- Renaming `karakeep-renderer` or other internal Docker networks solely for branding.
- Rewriting database/application persisted data for branding.
- Renaming protocol/export/compatibility identifiers.
- Publishing/renaming browser-extension store identity.
- Publishing/renaming mobile-store identity.
- Publishing/renaming npm/SDK package identity.
- Publishing/renaming MCP distribution identity.
- Rewriting Git history.
- Editing historical issues, pull requests, or comments merely to remove old URLs.
- Implementing #25 landing-site publication or #26 docs-site publication as a prerequisite.

The internal machine-facing migration is owned by #35.

## Current repository facts that drive the plan

The current repository explicitly treats `docs/fork-setup.md` as the production/operator source of truth and `deploy/docker-compose.prod.yml` as the canonical personal VPS Compose file. Production uses split `web` and `workers` images and Watchtower polls mutable release tags.

The current Docker workflow constructs `image_name="ghcr.io/${{ github.repository_owner }}/karakeep"`, so renaming the GitHub repository alone will **not** rename the GHCR package. `.github/workflows/docker.yml` must be changed deliberately.

Current production Compose defaults are explicitly:

- `ghcr.io/absolutepraya/karakeep:web-main`
- `ghcr.io/absolutepraya/karakeep:workers-main`

The guided installer also hardcodes the fork's old repository/raw URL and old GHCR path. Its shell-level contract is covered by `bash scripts/install.test.sh`.

Current-tree searches also show the old GitHub identity in the README, assistant docs, installation docs, `docs/fork-setup.md`, `apps/web/components/shared/sidebar/SidebarVersion.tsx`, and other repository-facing documentation. Those hits must be classified, not blindly replaced: some old Karakeep references are intentional upstream attribution or historical specs.

## Public identity rules

### GitHub

The canonical public repository after cutover is `absolutepraya/marka`.

The existing GitHub repository is renamed in place. Do not create a new repository and migrate content manually. Do not later create another `absolutepraya/karakeep` repository, because the old path is reserved for GitHub's repository-rename redirect.

After rename:

- local `origin` remotes under our control must use `git@github.com:absolutepraya/marka.git`;
- current docs should use `https://github.com/absolutepraya/marka` where they mean this fork;
- raw installer URLs should use `https://raw.githubusercontent.com/absolutepraya/marka/...`;
- upstream Karakeep links such as `karakeep-app/karakeep` remain unchanged;
- historical design documents may retain old links if they describe an actual past state and are not active instructions.

### GHCR

The canonical fork package becomes `ghcr.io/absolutepraya/marka`.

This is a hard switch, not a compatibility alias strategy:

- new CI releases publish Marka tags only;
- production moves to Marka tags;
- new installer-generated configuration uses Marka tags;
- docs describe Marka tags;
- old `ghcr.io/absolutepraya/karakeep` tags stop advancing;
- historical old-package images may remain and must not be deleted as part of #27.

Before any production Compose switch, both canonical mutable tags must exist and resolve successfully:

- `ghcr.io/absolutepraya/marka:web-main`
- `ghcr.io/absolutepraya/marka:workers-main`

The paired-image release invariant remains unchanged: web and workers are built from the same successful commit, immutable SHA tags are pushed first, and mutable release tags are promoted only after both builds succeed.

### Application hostname

The canonical application origin is exactly `https://marka.abhipraya.dev`. No `app.marka.abhipraya.dev` hostname is introduced.

The new hostname must become fully functional while `keep.abhipraya.dev` is still available. Direct access to Marka is verified first. Only after that verification does the old hostname become a permanent redirect.

The redirect must preserve path and query string. Example:

```text
https://keep.abhipraya.dev/public/lists/abc?view=grid
→
https://marka.abhipraya.dev/public/lists/abc?view=grid
```

A `308 Permanent Redirect` is preferred where the reverse-proxy/DNS setup supports it cleanly.

Long-term there is one live application origin, not two parallel app origins.

### Origin-dependent application behavior

Any behavior derived from the application origin must be audited before the redirect is enabled, including:

- `NEXTAUTH_URL` or equivalent canonical auth/application URL;
- OAuth provider callback URLs actually configured on production;
- allowed origins/CORS settings actually enabled by this fork;
- cookie/session behavior across the hostname switch;
- webhook URLs or webhook payload links that embed the public origin;
- RSS/feed URLs;
- public list/share URLs;
- API/OpenAPI examples or server URLs that embed a production host;
- canonical link tags;
- Open Graph/Twitter URLs;
- structured-data URLs;
- PWA/web metadata where an absolute origin is present.

Do not invent integrations. During implementation, inspect the actual production configuration and repository before changing provider dashboards or webhook systems.

## Repository reference classification

Every current-tree hit for the old fork identity must be assigned to one of these classes:

1. **Active fork identity:** change to Marka.
2. **Upstream attribution:** keep Karakeep/upstream URL unchanged.
3. **Internal compatibility identifier:** leave unchanged under #35.
4. **Historical record:** normally leave unchanged unless it is still presented as current instruction.
5. **External distribution surface deferred from #27:** audit for breakage, then leave publishing identity unchanged.

This classification applies to searches for at least:

```text
absolutepraya/karakeep
github.com/absolutepraya/karakeep
raw.githubusercontent.com/absolutepraya/karakeep
ghcr.io/absolutepraya/karakeep
keep.abhipraya.dev
Karakeep
karakeep
```

Lowercase `karakeep` will produce many intentional machine-facing/internal hits. It is an audit input, not a replacement list.

## Known repository-controlled cutover surfaces

The implementation must inspect and update, where the classification says they are active fork identity:

- `.github/workflows/docker.yml`
- `deploy/docker-compose.prod.yml`
- `scripts/install.sh`
- `scripts/install.test.sh`
- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `docs/fork-setup.md`
- `docs/README.md`
- `docs/docs/02-installation/11-guided-docker-setup.md`
- other current installation pages returned by repository search
- `docs/docusaurus.config.ts` where the value is fork-owned rather than upstream-owned
- `apps/web/components/shared/sidebar/SidebarVersion.tsx`
- active metadata/canonical/share/RSS files found during implementation inventory

Historical specs/plans under `docs/superpowers/**` are not blanket rewrite targets. Update only documents that are still authoritative/current instructions, including this design and its implementation plan after the repository rename.

## GitHub-side settings inventory

Repository files do not cover all public identity. At implementation time, capture the current GitHub settings before the rename and inspect after the rename:

- repository name;
- description;
- website/homepage;
- topics;
- social preview;
- default branch;
- branch/ruleset behavior;
- Actions settings and environment references;
- repository secrets/variables names only, never values;
- webhooks if any;
- GitHub Pages configuration if any;
- package/repository linkage where applicable.

Only change settings whose values actually encode the old public identity. Do not disturb unrelated branch protection, secrets, permissions, or automation.

## Production backup boundary

Before the first production mutation, create a timestamped backup on the local MacBook running the plan.

The backup must contain, at minimum:

- a fresh copy of the production `/data` persisted state;
- the production Compose file as deployed;
- `.env` and workers-only environment/config files as deployed, copied locally without printing them;
- reverse-proxy configuration that controls the current app hostname;
- current running image names, tags, and immutable digests/IDs;
- a short manifest recording timestamp, source host, source Compose directory, and file checksums/sizes without secret contents.

The backup directory must remain outside the Git repository and must never be staged or committed.

The agent must verify the backup is readable before proceeding. Verification means listing the local files, checking the archive/test extraction or copied data structure, and recording checksums/size metadata without exposing secret values.

No automated retention/deletion policy is part of #27.

## Cutover staging model

The migration uses checkpoints, not a rollback choreography.

### Checkpoint 0: plan readiness

Before implementation:

- update the implementation worktree/branch from current `main`;
- read `AGENTS.md` and `docs/fork-setup.md` again because they may have changed since this design was written;
- inspect issue #27 and #35 for newer decisions;
- inventory the exact current-tree references and current live configuration;
- do not mutate external systems yet.

### Checkpoint 1: repository changes prepared

Prepare code/docs changes that can be reviewed before the external rename:

- workflow image path moves to `.../marka`;
- Compose defaults move to `.../marka`;
- installer uses Marka repo/raw/GHCR identity;
- tests expect Marka identity;
- current docs/repository links move to `absolutepraya/marka`;
- active public-origin references use `marka.abhipraya.dev` where they are meant to represent the post-cutover target;
- internal compatibility names remain untouched.

Do not merge/publish this state in a way that causes production consumers to switch before the external prerequisites exist.

### Checkpoint 2: local production backup complete

Create and verify the MacBook-local production backup. This must happen immediately before the live cutover phase, after the plan and repository changes are ready.

### Checkpoint 3: GitHub repository rename

Rename the existing repository to `absolutepraya/marka`. Then immediately:

- verify the new URL resolves;
- verify the old URL redirects;
- update the local `origin` URL;
- verify fetch/push access using the new remote;
- confirm the implementation branch still exists under the renamed repository.

### Checkpoint 4: publish Marka images

Apply/push the prepared workflow change so CI publishes the canonical Marka image package. Wait for a successful image workflow associated with a successful CI commit.

Verify both mutable Marka tags exist before production configuration points to them. Record their digests and confirm they correspond to the intended commit.

Do not dual-publish the old fork package.

### Checkpoint 5: make Marka hostname directly reachable

Create/update DNS and reverse-proxy/TLS configuration so `https://marka.abhipraya.dev` reaches the current application deployment without redirecting `keep.abhipraya.dev` yet.

Update production origin/auth configuration needed for the new hostname. Restart/recreate only the services required for the configuration to take effect.

Directly verify Marka auth and application behavior.

### Checkpoint 6: switch production images

Change production Compose/image overrides to the canonical Marka web/workers tags. Use the controlled maintenance window and pause automatic updates if necessary to avoid Watchtower racing manual changes.

Verify production is actually running Marka image references/digests and both web/workers are healthy before resuming automatic updates.

### Checkpoint 7: complete public-origin verification

Exercise the required smoke-test matrix on `marka.abhipraya.dev`, including generated public URLs and background processing.

Only after this checkpoint succeeds may the legacy hostname redirect be enabled.

### Checkpoint 8: legacy hostname redirect

Convert `keep.abhipraya.dev` to a permanent redirect that preserves path and query string. Verify representative root, authenticated-entry, public-list, and query-string URLs.

Do not keep the old hostname serving the application after the redirect is accepted.

### Checkpoint 9: repository/GitHub presentation cleanup

Finish GitHub-side description/homepage/topics/social-preview/package linkage and any active current-tree references that could not safely be finalized before the external rename.

Run the final repository audit and record intentional remaining `karakeep` categories.

## Required production smoke tests

The agent must record pass/fail evidence for every applicable item.

### Infrastructure

- `marka.abhipraya.dev` resolves correctly.
- HTTPS certificate is valid for `marka.abhipraya.dev`.
- web service healthy.
- workers service healthy.
- Meilisearch reachable/healthy.
- renderer/browser pipeline works.
- configured AI functionality works if production enables it.

### Authentication

- direct login through `marka.abhipraya.dev` succeeds.
- authenticated reload preserves session.
- logout succeeds.
- no redirect loop between old/new hosts.

### Core application

- bookmark library loads.
- create a disposable test bookmark.
- edit the disposable test bookmark.
- search finds expected content.
- crawler/archive processing for a test URL completes.
- screenshot processing completes.
- delete the disposable test bookmark.

### Public behavior

- publish/open a test public list or use an existing safe public list.
- public-list owner/avatar/current UI behavior renders as expected.
- generated public-list/share URL uses `https://marka.abhipraya.dev`.
- RSS/feed endpoint works where enabled.
- generated RSS URL uses the Marka origin.

### Distribution/deployment

- `ghcr.io/absolutepraya/marka:web-main` exists.
- `ghcr.io/absolutepraya/marka:workers-main` exists.
- both mutable tags correspond to the intended paired release commit.
- production web actually uses the Marka image.
- production workers actually use the Marka image.
- Watchtower is running again and follows the new paths.
- a later normal main-branch image publish can still be detected by the deployment path; do not manufacture an unnecessary production change solely to prove this if the current Watchtower/image inspection already demonstrates correct tracking.

### Legacy paths

- old GitHub repository URL redirects to the renamed repository.
- fresh clone using `git@github.com:absolutepraya/marka.git` works.
- old `keep.abhipraya.dev` root redirects to Marka.
- old public-list path redirects to the same path on Marka.
- old URL with query string preserves the query on Marka.

## Verification for repository changes

Run the repository's normal checks appropriate to changed code:

```bash
pnpm format:fix
pnpm lint
pnpm typecheck
bash scripts/install.test.sh
```

Run focused tests for any web URL/metadata logic changed by #27. Run the full test suite if the branch touches runtime code outside straightforward static URL/copy configuration and the current CI baseline permits it.

Before claiming completion, run explicit searches for old fork identities and categorize every remaining hit:

```bash
rg -n --hidden --glob '!node_modules' --glob '!.git' 'absolutepraya/karakeep|github\.com/absolutepraya/karakeep|raw\.githubusercontent\.com/absolutepraya/karakeep|ghcr\.io/absolutepraya/karakeep|keep\.abhipraya\.dev' .
```

Then run broader case-sensitive/case-insensitive searches for Karakeep naming and classify remaining hits as upstream attribution, internal compatibility identifier (#35), historical record, or deferred distribution identity. Do not turn this into a blind replacement exercise.

## Documentation behavior after cutover

After the external migration, current authoritative docs must consistently say:

- this is the **Marka** fork;
- origin is `git@github.com:absolutepraya/marka.git`;
- public repository is `https://github.com/absolutepraya/marka`;
- guided install raw URL points at `absolutepraya/marka`;
- fork images are `ghcr.io/absolutepraya/marka:web-main` and `:workers-main`;
- canonical application origin is `https://marka.abhipraya.dev` where a real operator hostname is appropriate to document;
- internal `KARAKEEP_*`, package scopes, services, and network names remain intentionally unchanged pending #35.

Public/general installation docs should continue to use placeholders instead of leaking personal operator details unless the document is explicitly the fork-owner/operator guide.

## Deferred issue audit

During final audit, inspect browser extension, mobile, npm/SDK, and MCP source/config for hard dependencies on:

- `absolutepraya/karakeep`;
- `raw.githubusercontent.com/absolutepraya/karakeep`;
- `ghcr.io/absolutepraya/karakeep`;
- `keep.abhipraya.dev`.

If a dependency would break because #27 changed one of those external resources, fix only that coupling as part of #27. Do not rename the distribution identity itself. If a broader rename is desirable, create a dedicated follow-up issue rather than expanding #27.

## Completion rule

The implementation agent must not automatically close #27. After all checks pass, post or prepare a concise evidence report covering the repository rename, GHCR digests, production image paths, hostname/auth smoke tests, redirect verification, local backup location (path only, never secret contents), and remaining intentional Karakeep identifier categories. Final issue closure remains an explicit owner action.
