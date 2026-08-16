# Marka Public Identity Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the actively operated fork identity over to `absolutepraya/marka`, `ghcr.io/absolutepraya/marka`, and `https://marka.abhipraya.dev` without renaming compatibility-sensitive internal Karakeep identifiers.

**Architecture:** Prepare all repository-controlled identity changes on one isolated branch, then execute a checkpointed external cutover: local MacBook backup, in-place GitHub repository rename, merge/publish Marka GHCR images, bring up the new hostname directly, move production to the Marka images, verify the complete application, and only then redirect the legacy hostname. `NEXTAUTH_URL` is the runtime source for `serverConfig.publicUrl` and `publicApiUrl`, so the production-origin migration is primarily a deployment/configuration operation rather than a new URL-generation subsystem.

**Tech Stack:** Git/GitHub, GitHub Actions, GHCR, Docker Compose, Watchtower, nginx/reverse proxy, Cloudflare/DNS/TLS as currently deployed, Next.js/TypeScript, pnpm, shell installer tests.

## Global Constraints

- Public repository target is exactly `absolutepraya/marka`.
- Canonical application origin is exactly `https://marka.abhipraya.dev`; do not introduce `app.marka.abhipraya.dev`.
- Canonical fork images are exactly `ghcr.io/absolutepraya/marka:web-main` and `ghcr.io/absolutepraya/marka:workers-main`.
- Do not dual-publish new releases to `ghcr.io/absolutepraya/karakeep`; leave historical old-package images alone.
- `keep.abhipraya.dev` remains live until Marka passes direct validation, then becomes a permanent path- and query-preserving redirect.
- Keep `KARAKEEP_*`, `@karakeep/*`, persisted paths, Compose service/project names, Docker networks, protocol/export identifiers, and other compatibility-sensitive internal names unchanged under #27. #35 owns their later migration.
- Do not rewrite Git history or historical issues/PRs/comments merely to remove old names.
- Browser extension/mobile/npm/SDK/MCP distribution identities are audit-only in #27; do not rename/publish those identities here.
- Do not rename the VPS deployment directory or the MacBook checkout directory in #27. Both are machine-facing paths deferred to #35 after the public cutover stabilizes.
- Before the first production mutation, copy a fresh production backup to the local MacBook running this plan and verify it is readable. Never commit or print secrets.
- A short controlled maintenance window is acceptable. Do not add complexity solely for zero downtime.
- The GitHub rename is forward-only, but service recovery is mandatory until the legacy redirect is enabled. Retain the verified backup and captured Compose, environment, image, and nginx state. If direct Marka validation fails, restore the previous application origin, image references, and old-host application server block before continuing. Never recreate the old GitHub repository name.
- Do not close #27 automatically.

---

## File Structure and Responsibilities

### Durable design/planning files already created on the planning branch

- `docs/adr/0001-marka-public-identity-cutover-boundary.md` - durable public-vs-internal identity decision.
- `docs/superpowers/specs/2026-08-15-marka-public-identity-cutover-design.md` - approved #27 design and validation contract.
- `docs/superpowers/plans/2026-08-15-marka-public-identity-cutover.md` - this execution plan.

### Known implementation files

- `.github/workflows/docker.yml` - publish fork images under `ghcr.io/absolutepraya/marka`.
- `deploy/docker-compose.prod.yml` - production defaults for paired Marka web/workers images.
- `scripts/install.sh` - guided installer fork repository/raw URL and generated Marka image defaults.
- `scripts/install.test.sh` - installer assertions for repository/GHCR defaults.
- `apps/web/components/shared/sidebar/SidebarVersion.tsx` - current fork GitHub repo/commit link.
- `README.md` - canonical public fork repository identity and install links.
- `CONTRIBUTING.md` - active contribution/repository references.
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` - assistant/operator repo identity and guided install references.
- `docs/fork-setup.md` - canonical fork operator/deployment source of truth.
- `docs/README.md` - docs development references if they point at the fork repository.
- `docs/docs/02-installation/11-guided-docker-setup.md` - guided installer contract and image/repository examples.
- `docs/docusaurus.config.ts` - update only fork-owned GitHub/repository metadata; preserve upstream-owned URLs.
- Current installation pages found by the final repository search - update only active fork-specific links, not generic upstream instructions or versioned historical copies unless they are intentionally current.

### Runtime configuration, not source renames

- Production `NEXTAUTH_URL` becomes `https://marka.abhipraya.dev`.
- Production `packages/shared/config.ts` does **not** need a branding rename: it already derives `serverConfig.publicUrl` from `NEXTAUTH_URL` and `publicApiUrl` from that origin.
- Actual OAuth callback/provider settings, CORS/origin settings, webhook destinations, and reverse-proxy files are discovered from the live configuration at execution time because secrets/operator-specific values must not be committed or guessed.

---

### Task 1: Refresh the execution workspace and produce the final cutover inventory

**Files:**
- Read: `AGENTS.md`
- Read: `docs/fork-setup.md`
- Read: `docs/superpowers/specs/2026-08-15-marka-public-identity-cutover-design.md`
- Read: `docs/adr/0001-marka-public-identity-cutover-boundary.md`
- Read: issue #27 and issue #35 through GitHub
- Modify: none

**Interfaces:**
- Consumes: current `main`, planning branch `absolutepraya/marka-public-cutover-plan`, current production `.env` access available only at execution time.
- Produces: a current classified list of old fork-identity references and a confirmed implementation worktree based on the latest `main`.

- [ ] **Step 1: Create an isolated execution worktree using the repository's `wt` workflow**

Use the `wt` skill and CLI. Base the execution worktree on the latest `origin/main`, then bring the three planning documents from `absolutepraya/marka-public-cutover-plan` into the implementation branch if they are not already merged.

Do not edit a stale root worktree.

- [ ] **Step 2: Re-read current repository guidance**

```bash
git status --short --branch
git remote -v
sed -n '1,220p' AGENTS.md
sed -n '1,260p' docs/fork-setup.md
```

Expected before the GitHub rename: `origin` still resolves to `absolutepraya/karakeep`; the worktree is clean except for intentionally carried planning commits.

- [ ] **Step 3: Inventory old public identities in the current tree**

```bash
rg -n --hidden \
  --glob '!node_modules' \
  --glob '!.git' \
  'absolutepraya/karakeep|github\.com/absolutepraya/karakeep|raw\.githubusercontent\.com/absolutepraya/karakeep|ghcr\.io/absolutepraya/karakeep|keep\.abhipraya\.dev' .
```

For each hit, classify it in working notes as exactly one of:

```text
ACTIVE_FORK_IDENTITY
UPSTREAM_ATTRIBUTION
INTERNAL_COMPATIBILITY_#35
HISTORICAL_RECORD
DEFERRED_DISTRIBUTION
```

Do not commit the working notes if they contain operator-specific details.

- [ ] **Step 4: Run the broad Karakeep-name audit without replacing anything**

```bash
rg -ni --hidden --glob '!node_modules' --glob '!.git' 'karakeep' . > /tmp/marka-karakeep-audit.txt
wc -l /tmp/marka-karakeep-audit.txt
```

Use this only to identify missed active public surfaces. `KARAKEEP_*`, `@karakeep/*`, upstream references, data paths, Compose services, and Docker networks are expected to remain.

- [ ] **Step 5: Confirm the known runtime origin behavior before changing source**

```bash
rg -n 'NEXTAUTH_URL|publicUrl|publicApiUrl' packages/shared packages/api packages/trpc apps/web
```

Confirm `packages/shared/config.ts` still maps `NEXTAUTH_URL` to `serverConfig.publicUrl` and builds `publicApiUrl` from it. If that invariant still holds, do not add a second Marka-origin constant.

- [ ] **Step 6: Commit only if the planning documents had to be carried onto a fresh implementation branch**

```bash
git add docs/adr/0001-marka-public-identity-cutover-boundary.md \
  docs/superpowers/specs/2026-08-15-marka-public-identity-cutover-design.md \
  docs/superpowers/plans/2026-08-15-marka-public-identity-cutover.md
git commit -m "docs: plan Marka public identity cutover"
```

Expected: no runtime/external mutation yet.

---

### Task 2: Change the fork's GHCR publishing contract to Marka

**Files:**
- Modify: `.github/workflows/docker.yml`
- Modify: `deploy/docker-compose.prod.yml`
- Modify: `scripts/install.sh`
- Modify: `scripts/install.test.sh`
- Modify: `docs/docs/02-installation/11-guided-docker-setup.md`
- Modify: `docs/fork-setup.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `GEMINI.md`

**Interfaces:**
- Consumes: existing paired web/workers build flow and mutable `web-main` / `workers-main` promotion semantics.
- Produces: one canonical fork image package `ghcr.io/absolutepraya/marka` with unchanged tag semantics.

- [ ] **Step 1: Update installer tests first**

In `scripts/install.test.sh`, change assertions that intentionally describe this fork's image package from:

```text
ghcr.io/absolutepraya/karakeep:web-main
ghcr.io/absolutepraya/karakeep:workers-main
```

to:

```text
ghcr.io/absolutepraya/marka:web-main
ghcr.io/absolutepraya/marka:workers-main
```

Also update assertions for the fork's raw installer URL from `absolutepraya/karakeep` to `absolutepraya/marka` when those assertions represent the canonical fork entry point. Leave generic internal `karakeep` Compose/data names untouched.

- [ ] **Step 2: Run the installer tests and verify they fail against the old implementation**

```bash
bash scripts/install.test.sh
```

Expected: at least the changed canonical-repository/GHCR assertions fail because `scripts/install.sh` still emits the old public identity.

- [ ] **Step 3: Change the Docker workflow image package**

In `.github/workflows/docker.yml`, change only the fork package basename in `Prepare image metadata`:

```bash
image_name="ghcr.io/${{ github.repository_owner }}/marka"
```

Keep all of these unchanged:

```text
web-sha-<sha>
workers-sha-<sha>
web-main
workers-main
paired immutable build first
paired mutable promotion only after both builds succeed
```

Do not add old-package alias tags.

- [ ] **Step 4: Change production Compose image defaults**

In `deploy/docker-compose.prod.yml`, set:

```yaml
services:
  web:
    image: ${KARAKEEP_WEB_IMAGE:-ghcr.io/absolutepraya/marka:web-main}
  workers:
    image: ${KARAKEEP_WORKERS_IMAGE:-ghcr.io/absolutepraya/marka:workers-main}
```

Do not rename `KARAKEEP_WEB_IMAGE`, `KARAKEEP_WORKERS_IMAGE`, service names, volumes, or `karakeep-renderer` in #27.

- [ ] **Step 5: Change guided installer public fork defaults**

In `scripts/install.sh`, update every value classified `ACTIVE_FORK_IDENTITY` so that:

```text
GitHub repository  = absolutepraya/marka
raw installer repo = absolutepraya/marka
web image          = ghcr.io/absolutepraya/marka:web-main
workers image      = ghcr.io/absolutepraya/marka:workers-main
```

Do not rename generated config directories, Compose project name, environment-variable names, helper command names, or data paths merely because they contain lowercase `karakeep`; those belong to #35.

- [ ] **Step 6: Update the canonical image-path documentation**

Update the listed authoritative docs/assistant files so every statement about **this fork's current GHCR images** uses:

```text
ghcr.io/absolutepraya/marka:web-main
ghcr.io/absolutepraya/marka:workers-main
```

Keep upstream images such as `ghcr.io/karakeep-app/karakeep-chrome:release` unchanged.

- [ ] **Step 7: Re-run installer validation**

```bash
bash scripts/install.test.sh
```

Expected: PASS.

- [ ] **Step 8: Verify no active old fork package remains in implementation-controlled files**

```bash
rg -n 'ghcr\.io/absolutepraya/karakeep' \
  .github deploy scripts README.md CONTRIBUTING.md AGENTS.md CLAUDE.md GEMINI.md docs apps
```

Expected: only historical records, if any. No current workflow/Compose/installer/operator instruction may retain the old fork package.

- [ ] **Step 9: Commit the distribution-contract change**

```bash
git add .github/workflows/docker.yml deploy/docker-compose.prod.yml \
  scripts/install.sh scripts/install.test.sh \
  docs/docs/02-installation/11-guided-docker-setup.md docs/fork-setup.md \
  AGENTS.md CLAUDE.md GEMINI.md
git commit -m "chore: move fork images to Marka GHCR path"
```

---

### Task 3: Change active repository identity references to `absolutepraya/marka`

**Files:**
- Modify: `apps/web/components/shared/sidebar/SidebarVersion.tsx`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `GEMINI.md`
- Modify: `docs/fork-setup.md`
- Modify: `docs/README.md` if it contains active fork repository links
- Modify: `docs/docs/02-installation/11-guided-docker-setup.md`
- Modify: active installation pages identified by Task 1
- Modify: `docs/docusaurus.config.ts` only for fork-owned repository metadata
- Modify: this design/plan only after the live rename when their current-repository links become active instructions

**Interfaces:**
- Consumes: the Task 1 classification.
- Produces: all current active fork links point to `absolutepraya/marka`, while upstream/historical/internal references remain correct.

- [ ] **Step 1: Update the visible sidebar repository link**

In `apps/web/components/shared/sidebar/SidebarVersion.tsx`, change:

```ts
const FORK_REPO = "absolutepraya/karakeep";
```

to:

```ts
const FORK_REPO = "absolutepraya/marka";
```

Keep commit-SHA validation and URL construction unchanged.

- [ ] **Step 2: Update canonical public and operator docs**

Where the text refers to this fork, replace the active repository identities with:

```text
https://github.com/absolutepraya/marka
git@github.com:absolutepraya/marka.git
https://raw.githubusercontent.com/absolutepraya/marka/main/scripts/install.sh
```

Apply this to `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `docs/fork-setup.md`, `docs/README.md` if applicable, and `docs/docs/02-installation/11-guided-docker-setup.md`.

Do **not** alter `https://github.com/karakeep-app/karakeep` or any other upstream attribution.

- [ ] **Step 3: Update other current installation pages surfaced by the exact search**

Re-run:

```bash
rg -n --hidden --glob '!node_modules' --glob '!.git' \
  'absolutepraya/karakeep|github\.com/absolutepraya/karakeep|raw\.githubusercontent\.com/absolutepraya/karakeep' .
```

For every `ACTIVE_FORK_IDENTITY` hit, update to `absolutepraya/marka`. For `HISTORICAL_RECORD`, leave the text as historical unless that document is still an active runbook. Do not mechanically edit versioned upstream docs merely because the repository search found them.

- [ ] **Step 4: Audit Docusaurus repository metadata**

Open `docs/docusaurus.config.ts`. Change a GitHub/repository URL only if it points specifically at this fork's old repository. Preserve upstream `karakeep-app/karakeep`, `karakeep.app`, or upstream documentation links when they are intentionally upstream-owned.

- [ ] **Step 5: Verify the active repository reference audit**

```bash
rg -n --hidden --glob '!node_modules' --glob '!.git' \
  'absolutepraya/karakeep|github\.com/absolutepraya/karakeep|raw\.githubusercontent\.com/absolutepraya/karakeep' .
```

Expected before final historical classification: no active current instructions, runtime links, installer entry points, or current fork presentation remain on the old repository path.

- [ ] **Step 6: Run focused source checks**

```bash
pnpm format:fix
pnpm lint
pnpm typecheck
```

Expected: PASS, subject to an already-known repository baseline unrelated to this branch. Any new failure caused by this task must be fixed before proceeding.

- [ ] **Step 7: Commit the repository-identity source changes**

```bash
git add apps/web/components/shared/sidebar/SidebarVersion.tsx \
  README.md CONTRIBUTING.md AGENTS.md CLAUDE.md GEMINI.md \
  docs/fork-setup.md docs/README.md docs/docs docs/docusaurus.config.ts
git commit -m "chore: point public fork identity at absolutepraya/marka"
```

If `git status` shows unrelated versioned historical files changed by an accidental broad replacement, restore those files before committing.

---

### Task 4: Audit origin-derived runtime behavior and prepare production-host settings

**Files:**
- Read: `packages/shared/config.ts`
- Read: `packages/api/utils/rss.ts`
- Read: `packages/api/routes/rss.ts`
- Read: `packages/trpc/email.ts`
- Read: `packages/trpc/routers/subscriptions.ts`
- Search/read: public-list/share URL producers and metadata files returned by the commands below
- Modify: source files only if a hardcoded old production hostname is actually present
- Modify at deployment time: production `.env` / provider dashboards / reverse-proxy config, never commit secrets

**Interfaces:**
- Consumes: `serverConfig.publicUrl` derived from `NEXTAUTH_URL`.
- Produces: proof that setting production `NEXTAUTH_URL=https://marka.abhipraya.dev` makes generated public URLs use Marka, plus an exact live-config checklist for any provider-specific callback/origin changes.

- [ ] **Step 1: Inspect every server-side public URL consumer**

```bash
rg -n 'serverConfig\.publicUrl|serverConfig\.publicApiUrl|NEXTAUTH_URL' \
  packages/shared packages/api packages/trpc apps/web
```

Confirm RSS/email/subscription/public URL construction derives from the server config rather than `keep.abhipraya.dev`.

- [ ] **Step 2: Search for hardcoded production hosts in runtime source**

```bash
rg -n 'keep\.abhipraya\.dev|marka\.abhipraya\.dev' \
  apps packages .env.sample docker kubernetes
```

Expected before source edits: no runtime hardcoded `keep.abhipraya.dev` that bypasses `NEXTAUTH_URL`. If a hardcoded old host exists and is genuinely fork-owned runtime behavior, replace it with config-derived behavior, not another hardcoded Marka host unless the file is explicitly operator documentation.

- [ ] **Step 3: Identify actual production auth integrations without exposing secrets**

On the MacBook, inspect only variable **names/presence** in the local operator `.env`, never values:

```bash
python - <<'PY'
from pathlib import Path
for raw in Path('.env').read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key = line.split('=', 1)[0]
    if key.startswith(('NEXTAUTH_', 'OAUTH_', 'TURNSTILE_', 'SMTP_', 'STRIPE_', 'KARAKEEP_PROD_')):
        print(key)
PY
```

Use the resulting presence list to decide which external callback/origin dashboards actually need inspection. Never paste provider secret values into issue comments or commits.

- [ ] **Step 4: Define the production environment change**

The live application config must contain:

```text
NEXTAUTH_URL=https://marka.abhipraya.dev
```

Do not rename `NEXTAUTH_URL` itself. Preserve all unrelated values.

For each configured OAuth/provider/origin integration discovered in Step 3, add the exact Marka callback/origin required by the current application route **before** removing or disabling the old callback. Determine the callback path from current auth configuration/source, not from memory.

- [ ] **Step 5: Run focused tests only if source code changed**

If Step 2 required source edits, add or update the nearest unit test to assert URLs are built from `serverConfig.publicUrl`, then run that focused test plus:

```bash
pnpm lint
pnpm typecheck
```

If no source code changed, record that the origin migration is deployment configuration only and continue.

- [ ] **Step 6: Commit only actual source/test changes**

If no runtime source was changed, do not create an empty commit.

---

### Task 5: Run complete repository validation before any external mutation

**Files:**
- Modify: implementation branch only to fix failures caused by Tasks 2-4

**Interfaces:**
- Consumes: prepared code/docs cutover branch.
- Produces: one reviewable branch that is safe to merge immediately after the GitHub rename.

- [ ] **Step 1: Run formatting, linting, and type checking**

```bash
pnpm format:fix
pnpm lint
pnpm typecheck
bash scripts/install.test.sh
```

Expected: PASS for branch-caused behavior.

- [ ] **Step 2: Run the repository's relevant tests**

Run focused tests for any runtime files changed. If runtime changes extend beyond static repository URL strings, run:

```bash
pnpm test
```

If the repository still has a known unrelated baseline failure, capture the exact failing job/test and prove it reproduces on the comparison baseline before treating it as non-blocking.

- [ ] **Step 3: Inspect the diff for accidental internal renames**

```bash
git diff origin/main...HEAD -- . ':!docs/superpowers/plans/2026-08-15-marka-public-identity-cutover.md' ':!docs/superpowers/specs/2026-08-15-marka-public-identity-cutover-design.md'
```

Reject changes that rename `KARAKEEP_*`, `@karakeep/*`, `karakeep-renderer`, persisted paths, or Compose services solely for branding.

- [ ] **Step 4: Run the old-public-identity audit**

```bash
rg -n --hidden --glob '!node_modules' --glob '!.git' \
  'absolutepraya/karakeep|github\.com/absolutepraya/karakeep|raw\.githubusercontent\.com/absolutepraya/karakeep|ghcr\.io/absolutepraya/karakeep|keep\.abhipraya\.dev' .
```

At this stage, remaining hits must be explainable as historical design records or the documented legacy redirect source. Active fork code/docs must not depend on old GitHub/GHCR identities.

- [ ] **Step 5: Push the prepared implementation branch without merging it yet**

```bash
git push -u origin HEAD
```

Expected: branch is available on GitHub for review while production/GitHub identity are still unchanged.

---

### Task 6: Capture and verify the MacBook-local production backup

**Files:**
- Local-only output outside the repository: `~/Backups/marka-cutover/<UTC_TIMESTAMP>/`
- Read locally: root `.env` for `KARAKEEP_PROD_*` connection metadata; do not print secrets
- Read remotely: deployed Compose directory and nginx/reverse-proxy configuration

**Interfaces:**
- Consumes: current known-good production state immediately before live mutation.
- Produces: verified local data/config snapshot and a non-secret manifest.

- [ ] **Step 1: Create a timestamped local backup directory outside the repository**

```bash
BACKUP_ROOT="$HOME/Backups/marka-cutover/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_ROOT"
printf '%s\n' "$BACKUP_ROOT"
```

Record the printed path in private working notes. Do not commit the backup.

- [ ] **Step 2: Load only the production connection metadata needed by existing tooling**

Use the repository's documented `.env`/production helper conventions. Do not `cat .env`. Confirm the required keys exist by name:

```bash
python - <<'PY'
from pathlib import Path
keys = {line.split('=',1)[0].strip() for line in Path('.env').read_text().splitlines() if '=' in line and not line.lstrip().startswith('#')}
required = {'KARAKEEP_PROD_SSH_HOST', 'KARAKEEP_PROD_COMPOSE_DIR', 'DATA_DIR'}
missing = sorted(required - keys)
if missing:
    raise SystemExit(f"missing required keys: {', '.join(missing)}")
print('required production connection keys are present')
PY
```

Expected: `required production connection keys are present`.

- [ ] **Step 3: Pull a fresh copy of production persisted `/data` using the existing helper**

First inspect without mutation:

```bash
pnpm prod:pull-state --dry-run
```

Then perform the documented full-state pull into the local dev `DATA_DIR`:

```bash
pnpm prod:pull-state
```

Copy the resulting local data snapshot into the backup root without following it back into Git:

```bash
cp -a "$(python - <<'PY'
from pathlib import Path
for line in Path('.env').read_text().splitlines():
    if line.startswith('DATA_DIR='):
        print(line.split('=',1)[1].strip())
        break
PY
)" "$BACKUP_ROOT/data"
```

If the repository helper's contract has changed, follow the current `docs/fork-setup.md` contract instead and update this plan before proceeding.

- [ ] **Step 4: Copy deployed configuration files locally without printing contents**

Resolve `KARAKEEP_PROD_SSH_HOST`, optional `KARAKEEP_PROD_SSH_USER`, and `KARAKEEP_PROD_COMPOSE_DIR` from `.env` using the same safe parser approach as the repository helper. Copy the deployed Compose file and environment files using `scp` into `$BACKUP_ROOT/config/`.

The files to capture when present are:

```text
docker-compose.yml or the deployed canonical Compose filename
.env
.workers.env
```

Do not display file contents in terminal logs or issue comments.

- [ ] **Step 5: Capture reverse-proxy configuration and current image identity**

Over SSH, save `nginx -T` output to a file under `$BACKUP_ROOT/config/` rather than the repository, and save non-secret Docker inspection output containing current image names/IDs/digests for `web` and `workers`.

The output may contain hostnames and paths but must not contain environment-variable values or container environment dumps.

- [ ] **Step 6: Generate a non-secret local manifest and verify readability**

```bash
find "$BACKUP_ROOT" -type f -print0 | sort -z | xargs -0 shasum -a 256 > "$BACKUP_ROOT/SHA256SUMS"
du -sh "$BACKUP_ROOT"
find "$BACKUP_ROOT" -maxdepth 3 -type f -print
```

Then verify a representative SQLite/database file can be opened read-only or run the repository's safe local state validation against the copied data without modifying the backup.

Expected: backup files exist, checksums are generated, and the persisted state is readable.

- [ ] **Step 7: Stop if backup verification is incomplete**

Do not rename the repository, touch DNS, or change production until Task 6 is fully successful.

---

### Task 7: Rename the GitHub repository in place and update the execution remote

**Files:**
- External: GitHub repository metadata
- Local Git config: execution worktree `origin`
- Modify after rename: current planning/spec links if they are active current-repository references

**Interfaces:**
- Consumes: prepared, pushed branch and verified local backup.
- Produces: live repository `absolutepraya/marka` with old-path redirect intact and a working new Git remote.

- [ ] **Step 1: Re-confirm the repository is still named `absolutepraya/karakeep` and the prepared branch is pushed**

```bash
gh repo view absolutepraya/karakeep --json nameWithOwner,url,defaultBranchRef

git status --short --branch
git log -1 --oneline
```

Expected: clean branch and repository still on old name.

- [ ] **Step 2: Rename the existing repository in place**

Using authenticated GitHub CLI from the MacBook:

```bash
gh api --method PATCH repos/absolutepraya/karakeep -f name=marka --jq '.full_name'
```

Expected output:

```text
absolutepraya/marka
```

Do not create a new repository at either path.

- [ ] **Step 3: Update the local `origin` URL immediately**

```bash
git remote set-url origin git@github.com:absolutepraya/marka.git
git remote -v
git fetch origin
```

Expected: fetch succeeds through the new canonical path.

- [ ] **Step 4: Verify old and new repository behavior**

```bash
gh repo view absolutepraya/marka --json nameWithOwner,url
git ls-remote git@github.com:absolutepraya/marka.git HEAD
```

Also verify the old web repository URL redirects to the new repository. Do **not** create `absolutepraya/karakeep` as a placeholder.

- [ ] **Step 5: Update active planning-document links that still describe the current repo with the old path**

Change current links in the ADR/spec/plan from `https://github.com/absolutepraya/karakeep/...` to the renamed repository when they are intended as current navigation. Preserve explicit historical examples describing the pre-cutover state.

- [ ] **Step 6: Commit and push any post-rename documentation fixups**

```bash
git add docs/adr/0001-marka-public-identity-cutover-boundary.md \
  docs/superpowers/specs/2026-08-15-marka-public-identity-cutover-design.md \
  docs/superpowers/plans/2026-08-15-marka-public-identity-cutover.md
git commit -m "docs: point cutover records at renamed repository" || true
git push origin HEAD
```

If there were no link changes, do not create an empty commit.

---

### Task 8: Merge the prepared cutover branch and publish the Marka GHCR package

**Files:**
- External: GitHub PR/main branch and Actions
- Consumes source changes from Tasks 2-5

**Interfaces:**
- Consumes: renamed GitHub repository and prepared branch.
- Produces: `main` capable of publishing only `ghcr.io/absolutepraya/marka` fork images.

- [ ] **Step 1: Update the implementation branch from renamed `origin/main` if main moved**

```bash
git fetch origin
git rebase origin/main
```

Resolve conflicts by preserving the #27 boundary. Re-run Task 5 validation after any conflict resolution.

- [ ] **Step 2: Open or update the implementation PR against `main`**

The PR description must state:

```text
- repository has already been renamed to absolutepraya/marka
- this PR switches fork GHCR publishing to ghcr.io/absolutepraya/marka
- production has NOT yet been pointed at the new images
- internal Karakeep identifiers remain intentionally unchanged (#35)
- local pre-cutover backup has been verified
```

Do not claim production cutover is complete.

- [ ] **Step 3: Wait for/review actual CI results and fix branch-caused failures**

Inspect failing job logs rather than guessing. The PR is merge-ready only when branch-caused checks are green or a known baseline failure has been explicitly demonstrated as unrelated.

- [ ] **Step 4: Merge only when explicitly authorized by the repository owner**

The project guardrail forbids merging without explicit instruction. If authorization has not been given in the execution conversation, stop here and report that the next external prerequisite is the PR merge.

- [ ] **Step 5: After authorized merge, inspect the Docker workflow run triggered from successful `main` CI**

Verify the workflow pushes the paired immutable tags and promotes:

```text
ghcr.io/absolutepraya/marka:web-main
ghcr.io/absolutepraya/marka:workers-main
```

- [ ] **Step 6: Verify both Marka mutable tags exist and record their digests**

Use GHCR/Docker tooling available on the MacBook, for example:

```bash
docker buildx imagetools inspect ghcr.io/absolutepraya/marka:web-main
docker buildx imagetools inspect ghcr.io/absolutepraya/marka:workers-main
```

Expected: both resolve successfully for `linux/amd64`. Record the resulting digest identifiers in private execution notes and later completion evidence.

- [ ] **Step 7: Prove the VPS can pull the new public package before the maintenance window**

From the VPS, without adding registry credentials, pull or inspect both canonical tags:

```bash
docker pull ghcr.io/absolutepraya/marka:web-main
docker pull ghcr.io/absolutepraya/marka:workers-main
```

Expected: both pulls succeed and resolve to the digests recorded in the prior step. A MacBook-local image inspection is not sufficient evidence because it can use local credentials. Do not stop Watchtower or alter deployed Compose references until this succeeds.

- [ ] **Step 8: Confirm the old package is no longer a workflow output**

Inspect the successful workflow logs/metadata. There must be no new `ghcr.io/absolutepraya/karakeep:*` push created by the updated workflow.

Do not delete historical old-package images.

---

### Task 9: Provision `marka.abhipraya.dev` as a direct application origin

**Files:**
- External: DNS/Cloudflare record for `marka.abhipraya.dev`
- External: nginx/reverse-proxy/TLS configuration on the VPS
- External/local secret config: production `.env`
- External provider dashboards: only actually configured auth/origin integrations

**Interfaces:**
- Consumes: existing production web listener and existing `keep.abhipraya.dev` setup.
- Produces: both old and new hostnames can reach the app during validation, with Marka configured as the canonical app origin.

- [ ] **Step 1: Inspect the current live hostname path before changing it**

On the VPS, capture the existing `keep.abhipraya.dev` nginx server block and listener/port mapping. Confirm which local port proxies to the `web` service. Compare with `docs/fork-setup.md` rather than assuming a container name.

- [ ] **Step 2: Create the Marka DNS record using the same target/proxy mode proven by the current deployment**

Create `marka.abhipraya.dev` pointing at the same VPS/application endpoint as the existing app. Preserve the currently working Cloudflare proxy/DNS mode unless there is verified evidence it must differ.

- [ ] **Step 3: Add a direct Marka reverse-proxy/TLS server configuration**

Configure nginx so `marka.abhipraya.dev` proxies to the same application listener as the current live host. At this stage, **do not** redirect `keep.abhipraya.dev`.

Obtain/verify TLS for the Marka hostname using the VPS's existing certificate workflow.

- [ ] **Step 4: Update production canonical application URL**

Edit the production environment file in place so it contains:

```text
NEXTAUTH_URL=https://marka.abhipraya.dev
```

Preserve all unrelated keys and secret values. Do not print the file.

- [ ] **Step 5: Update only actually configured external callbacks/origins**

For each OAuth/auth/provider/origin integration proven present in Task 4, add/update the exact callback/origin for `marka.abhipraya.dev`. Keep the old callback temporarily if the provider supports both and the old hostname is still live during validation.

- [ ] **Step 6: Reload/recreate only what is required for the new origin to take effect**

Reload nginx after configuration validation:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Recreate/restart the application services through Compose so the changed `NEXTAUTH_URL` is loaded. Use service names, not hardcoded generated container names.

- [ ] **Step 7: Verify direct Marka reachability before touching the old hostname**

From the MacBook:

```bash
curl -fsSI https://marka.abhipraya.dev/
```

Expected: valid HTTPS response from the application path with no redirect to `keep.abhipraya.dev`.

Then use a browser to verify direct login, authenticated reload/session persistence, and logout on Marka.

Stop here on any auth/cookie/redirect-loop problem.

---

### Task 10: Switch production web/workers to the Marka GHCR package

**Files:**
- External VPS deployed Compose/environment configuration
- Repository source already updated: `deploy/docker-compose.prod.yml`

**Interfaces:**
- Consumes: verified Marka GHCR tags from Task 8 and functioning Marka hostname from Task 9.
- Produces: live production running `ghcr.io/absolutepraya/marka:web-main` and `:workers-main`, with Watchtower tracking them.

- [ ] **Step 1: Enter the controlled maintenance window and prevent Watchtower from racing the manual switch**

From the deployed Compose directory:

```bash
docker compose stop watchtower
```

Confirm only Watchtower is stopped; do not destroy data volumes.

- [ ] **Step 2: Update the deployed Compose image references**

Ensure the deployed Compose file or its image overrides resolve to exactly:

```text
ghcr.io/absolutepraya/marka:web-main
ghcr.io/absolutepraya/marka:workers-main
```

Keep the same Compose project, services, volumes, networks, env files, ports, and data paths.

- [ ] **Step 3: Pull both images explicitly**

```bash
docker compose pull web workers
```

Expected: both Marka images pull successfully before the running services are replaced.

- [ ] **Step 4: Recreate web and workers from the new images**

```bash
docker compose up -d --no-deps --force-recreate web
docker compose up -d --no-deps --force-recreate workers
```

If current dependency/health requirements demand the documented safer ordering, start web first, wait until healthy, then workers.

- [ ] **Step 5: Verify service health and actual image identity**

```bash
docker compose ps
docker compose images
```

Use `docker inspect` by Compose service/container discovery to confirm web/workers resolve to the intended Marka image references/digests. Do not depend on generated container names in documentation.

- [ ] **Step 6: Restart Watchtower only after both application services are healthy**

```bash
docker compose start watchtower
docker compose ps watchtower
```

Confirm Watchtower is running and the Compose services it monitors now reference the Marka package paths.

---

### Task 11: Execute the Marka production smoke-test matrix

**Files:**
- Modify: none unless a failing check exposes a branch/config defect that must be fixed forward
- External: live application and production services

**Interfaces:**
- Consumes: live Marka origin and Marka GHCR production services.
- Produces: explicit evidence that the new identity is functional before legacy redirect.

- [ ] **Step 1: Verify infrastructure**

From the MacBook:

```bash
dig +short marka.abhipraya.dev
curl -fsSI https://marka.abhipraya.dev/
```

On the VPS:

```bash
docker compose ps
```

Confirm web, workers, Meilisearch, and Watchtower are healthy/running as expected.

- [ ] **Step 2: Verify authentication in a browser**

Perform, in order:

```text
1. login at https://marka.abhipraya.dev
2. authenticated page reload
3. close/reopen a normal tab and confirm session remains
4. logout
5. login again if needed for the remaining tests
```

No old-host redirect loop or cookie failure is acceptable.

- [ ] **Step 3: Verify core bookmark behavior**

Using a disposable test URL/bookmark:

```text
1. create bookmark
2. confirm it appears in library
3. edit its title
4. search for the edited title/content
5. wait for crawler/archive processing
6. verify screenshot processing
7. verify configured AI behavior if production AI is enabled
8. delete the disposable bookmark
```

- [ ] **Step 4: Verify public behavior and origin-derived URLs**

Publish/open a safe test public list or use a disposable existing list. Confirm:

```text
public-list page loads on marka.abhipraya.dev
owner/avatar/current public-list UI renders
newly copied/generated public-list URL begins https://marka.abhipraya.dev
RSS/feed URL begins https://marka.abhipraya.dev
RSS/feed request succeeds where RSS is enabled
```

If an origin-derived URL still uses the old host, trace it to `serverConfig.publicUrl`/configuration before changing application code.

- [ ] **Step 5: Verify deployment identity**

Confirm again that production is running the Marka web/workers images and Watchtower is active.

Do not enable the old-host redirect until every applicable check in Task 11 passes.

---

### Task 12: Convert `keep.abhipraya.dev` into the permanent legacy redirect

**Files:**
- External: nginx/reverse-proxy configuration for `keep.abhipraya.dev`
- DNS record remains present so legacy URLs continue resolving

**Interfaces:**
- Consumes: fully verified Marka app origin.
- Produces: one canonical live application origin with legacy URL continuity.

**Recovery boundary:** Until this task is complete, a failure on direct Marka validation must be recovered by restoring the pre-cutover application-origin setting, Compose image references, and old-host nginx application server block captured in Task 6. Do not attempt to reverse the GitHub rename or recreate `absolutepraya/karakeep`.

- [ ] **Step 1: Replace the old live-app server block with a path/query-preserving permanent redirect**

For nginx, use equivalent semantics to:

```nginx
server {
    server_name keep.abhipraya.dev;
    return 308 https://marka.abhipraya.dev$request_uri;
}
```

Preserve the site's existing TLS/listen directives needed for HTTPS on the legacy hostname. Do not redirect to a fixed `/` path because `$request_uri` must retain path and query.

- [ ] **Step 2: Validate and reload nginx**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Expected: config test succeeds before reload.

- [ ] **Step 3: Verify root redirect**

```bash
curl -sSI https://keep.abhipraya.dev/ | sed -n '1p;/^[Ll]ocation:/p'
```

Expected status: `308` and location `https://marka.abhipraya.dev/`.

- [ ] **Step 4: Verify path and query preservation**

Using a real safe public-list path discovered during Task 11:

```bash
curl -sSI 'https://keep.abhipraya.dev/<REAL_PUBLIC_LIST_PATH>?marka-cutover=1' | sed -n '1p;/^[Ll]ocation:/p'
```

Expected location exactly preserves `<REAL_PUBLIC_LIST_PATH>?marka-cutover=1` on `https://marka.abhipraya.dev`.

Do not substitute a made-up public-list identifier. Use the actual safe path verified in Task 11.

- [ ] **Step 5: Verify normal Marka access still does not redirect back**

```bash
curl -fsSI https://marka.abhipraya.dev/
```

Expected: application response, not a redirect to the old host.

---

### Task 13: Finish GitHub-side presentation and active documentation cleanup

**Files:**
- Modify as needed: `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `docs/fork-setup.md`, guided installer docs, planning docs
- External: GitHub repository description/homepage/topics/social preview/package linkage/settings

**Interfaces:**
- Consumes: completed live repo/GHCR/domain cutover.
- Produces: coherent current public repository presentation with intentional old-name remnants documented rather than accidentally retained.

- [ ] **Step 1: Audit GitHub repository metadata**

Inspect the renamed repository's:

```text
name
repository description
homepage/website
topics
social preview
default branch
Actions/environment references
webhooks, if any
GitHub Pages setting, if any
GHCR package linkage/presentation
```

Change only values that still encode the obsolete fork public identity. Do not alter unrelated permissions, secrets, rulesets, or branch protection.

- [ ] **Step 2: Run the final exact old-public-identity search**

```bash
rg -n --hidden --glob '!node_modules' --glob '!.git' \
  'absolutepraya/karakeep|github\.com/absolutepraya/karakeep|raw\.githubusercontent\.com/absolutepraya/karakeep|ghcr\.io/absolutepraya/karakeep|keep\.abhipraya\.dev' .
```

Allowed remaining classes are:

```text
HISTORICAL_RECORD
LEGACY_REDIRECT_DOCUMENTATION
```

There must be no current runtime/installer/deployment dependency on the old repo/GHCR identity.

- [ ] **Step 3: Run the broad Karakeep classification audit**

```bash
rg -ni --hidden --glob '!node_modules' --glob '!.git' 'karakeep' . > /tmp/marka-final-karakeep-audit.txt
```

Review remaining current-tree hits and make sure they fit one of:

```text
UPSTREAM_ATTRIBUTION
INTERNAL_COMPATIBILITY_#35
HISTORICAL_RECORD
DEFERRED_DISTRIBUTION
```

If an actual user-facing stale Marka/Karakeep branding miss is found, fix it now. Do not rename internal identifiers.

- [ ] **Step 4: Audit deferred distribution apps for broken coupling only**

```bash
rg -n 'absolutepraya/karakeep|raw\.githubusercontent\.com/absolutepraya/karakeep|ghcr\.io/absolutepraya/karakeep|keep\.abhipraya\.dev' \
  apps/browser-extension apps/mobile apps/mcp packages/sdk packages/open-api 2>/dev/null || true
```

If a hit breaks because the repository/domain/GHCR resource moved, update that dependency to the new public resource. Do not change the app/store/package distribution identity itself. Open a separate follow-up issue if a broader distribution rename is desired.

- [ ] **Step 5: Run final repository checks**

```bash
pnpm format:fix
pnpm lint
pnpm typecheck
bash scripts/install.test.sh
```

Run focused runtime tests changed by any final fixes.

- [ ] **Step 6: Commit final cleanup**

```bash
git status --short
git add -A
git diff --cached --check
git commit -m "docs: finalize Marka public identity references"
```

Before committing, inspect `git diff --cached --name-only` and ensure no local backup, `.env`, secret file, or unrelated historical mass-edit is staged.

- [ ] **Step 7: Push and use the normal PR/CI workflow for any post-cutover source changes**

```bash
git push origin HEAD
```

Do not merge a post-cutover cleanup PR without explicit owner authorization.

---

### Task 14: Record completion evidence without closing #27

**Files:**
- External: issue #27 comment, only after implementation/validation is actually complete
- Modify: none required

**Interfaces:**
- Consumes: completed validation evidence from Tasks 6-13.
- Produces: concise owner-reviewable cutover report and leaves issue state open.

- [ ] **Step 1: Assemble only non-secret evidence**

The report must include:

```text
Repository: https://github.com/absolutepraya/marka
Old repository redirect: verified/not verified
GHCR web-main digest: <actual digest recorded during execution>
GHCR workers-main digest: <actual digest recorded during execution>
Production image paths: exact Marka paths
Canonical origin: https://marka.abhipraya.dev
Auth smoke test: pass/fail
Core bookmark/crawler/screenshot smoke test: pass/fail
Public-list/RSS origin test: pass/fail
Legacy keep.abhipraya.dev redirect: pass/fail, including path/query preservation
Watchtower on new image paths: pass/fail
Local backup directory: local path only
Remaining Karakeep hits: summarized by upstream/internal/history/deferred categories
#35 internal-rename follow-up: still open
```

Never include `.env` values, tokens, provider secrets, SSH keys, or backup file contents.

- [ ] **Step 2: Post the evidence to #27**

Use a concise comment containing the actual values recorded during execution. Do not use placeholder text from this plan.

- [ ] **Step 3: Leave #27 open**

Report that the cutover implementation and validation are complete and wait for explicit owner instruction before closing #27.

---

## Self-review checklist for the implementation agent

Before claiming the plan is complete, verify all of the following:

- [ ] The repository was renamed in place, not recreated.
- [ ] `origin` uses `git@github.com:absolutepraya/marka.git`.
- [ ] No new workflow tag is pushed to `ghcr.io/absolutepraya/karakeep`.
- [ ] Both Marka mutable GHCR tags existed before production image switch.
- [ ] Production data/config backup existed locally on the MacBook before live mutation.
- [ ] `NEXTAUTH_URL` is the Marka origin in production.
- [ ] Marka worked directly before the old-host redirect was enabled.
- [ ] Production runs both Marka images and Watchtower is active.
- [ ] `keep.abhipraya.dev` preserves path and query in its permanent redirect.
- [ ] The VPS deployment directory and MacBook checkout directory were not renamed during #27; #35 owns their later path migration.
- [ ] Current repository/docs/runtime links use the Marka repo/GHCR identity.
- [ ] Internal Karakeep identifiers were not swept into #27.
- [ ] Browser/mobile/npm/SDK/MCP publishing identities were not broadened into this cutover.
- [ ] No secret or local backup file entered Git.
- [ ] #27 remains open pending explicit owner closure.
