# Prod State Pull Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe local command that pulls production Karakeep persisted state from the VPS into local development.

**Architecture:** A Bash operator script reads root `.env`, validates local and VPS configuration, exports the production Docker `/data` volume over SSH as a tar stream, backs up local data, and restores it locally. Package and docs changes expose the command and document required configuration without committing secrets.

**Tech Stack:** Bash, SSH, Docker Compose on the VPS, tar, pnpm scripts, Markdown docs.

---

## File Structure

- Create: `scripts/pull-prod-state.sh`
  - Owns all prod-to-local state pull behavior.
  - Supports dry-run default, `--yes`, `--db-only`, and `--skip-migrate`.
- Modify: `package.json`
  - Adds `prod:pull-state` as the stable local command.
- Modify: `.env.sample`
  - Documents non-secret prod sync variable names with placeholders.
- Modify: `README.md`
  - Adds user-facing operator command docs.
- Modify: `AGENTS.md`
  - Adds assistant-facing operator guidance and safety constraints.
- Modify: `docs/fork-setup.md`
  - Keeps the canonical fork operator guide aligned with the new command.

## Task 1: Add Script

**Files:**
- Create: `scripts/pull-prod-state.sh`

- [ ] **Step 1: Create script skeleton with flags and env loading**

Create `scripts/pull-prod-state.sh` with executable Bash code that:

```bash
#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: pnpm prod:pull-state [-- --yes] [-- --db-only] [-- --skip-migrate]

Pull production Karakeep persisted state from the VPS into local development.

Options:
  --yes           Replace local state. Without this, only print the plan.
  --db-only       Pull only db.db, db.db-wal, and db.db-shm.
  --skip-migrate  Do not run pnpm db:migrate after restore.
  -h, --help      Show this help.
USAGE
}
```

- [ ] **Step 2: Add validation helpers**

Add helpers for missing env vars, resolving repo root, creating timestamps, and building the SSH target without printing secrets.

- [ ] **Step 3: Add remote export**

Implement remote export through SSH:

```bash
cd "$KARAKEEP_PROD_COMPOSE_DIR"
container_id="$(docker compose ps -q "$service")"
docker compose pause "$service"
docker run --rm --volumes-from "$container_id":ro "$export_image" \
  sh -c 'cd /data && tar -cf - .'
docker compose unpause "$service"
```

For `--db-only`, tar only `db.db`, `db.db-wal`, and `db.db-shm` when present.

- [ ] **Step 4: Add local backup and restore**

Download the remote tar into a temp directory, validate it with `tar -tf`, extract into a temp restore directory, then:

- full mode: move existing `DATA_DIR` to `DATA_DIR.backups/prod-pull-<timestamp>` and replace it.
- db-only mode: back up `DATA_DIR`, remove local `db.db*`, and overlay the downloaded SQLite files.

- [ ] **Step 5: Add migration**

Run `pnpm db:migrate` after restore unless `--skip-migrate` is set.

- [ ] **Step 6: Verify shell syntax**

Run:

```bash
bash -n scripts/pull-prod-state.sh
```

Expected: no output and exit code 0.

## Task 2: Wire Command And Env Sample

**Files:**
- Modify: `package.json`
- Modify: `.env.sample`

- [ ] **Step 1: Add package script**

Add:

```json
"prod:pull-state": "bash scripts/pull-prod-state.sh"
```

- [ ] **Step 2: Add sample env keys**

Add placeholder keys:

```dotenv
KARAKEEP_PROD_SSH_HOST=vps
KARAKEEP_PROD_SSH_USER=
KARAKEEP_PROD_COMPOSE_DIR=/home/praya/karakeep
KARAKEEP_PROD_COMPOSE_SERVICE=web
KARAKEEP_PROD_EXPORT_IMAGE=alpine:3.20
```

## Task 3: Update Docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/fork-setup.md`

- [ ] **Step 1: Update README**

Add an operator section showing:

```bash
pnpm prod:pull-state
pnpm prod:pull-state -- --yes
pnpm prod:pull-state -- --yes --db-only
```

Include the warning that `--yes` replaces local development state and creates a backup.

- [ ] **Step 2: Update AGENTS.md**

Add assistant guidance:

- Use `pnpm prod:pull-state` for prod-to-local state pulls.
- Do not print `.env` secrets.
- Do not overwrite local state without `--yes`.
- Default to full `/data`; use `--db-only` only when explicitly requested.

- [ ] **Step 3: Update docs/fork-setup.md**

Add the same operator command, required `.env` keys, backup warning, full-state default, and DB-only caveat to the canonical fork setup guide.

## Task 4: Verify And Commit

**Files:**
- All changed files.

- [ ] **Step 1: Run syntax and dry-run checks**

Run:

```bash
bash -n scripts/pull-prod-state.sh
pnpm prod:pull-state
```

Expected:

- Shell syntax passes.
- Dry run reports missing prod env vars clearly if they are absent.

- [ ] **Step 2: Run formatting checks**

Run:

```bash
pnpm exec oxfmt --check scripts/pull-prod-state.sh package.json README.md AGENTS.md docs/fork-setup.md .env.sample docs/superpowers/plans/2026-06-19-prod-state-pull.md
```

Expected: all checked files use the correct format.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git diff --check
git diff --stat
```

Expected: no whitespace errors and only intended files changed.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add scripts/pull-prod-state.sh package.json .env.sample README.md AGENTS.md docs/fork-setup.md docs/superpowers/plans/2026-06-19-prod-state-pull.md
git commit -m "Add prod state pull script"
```
