# Shared Local Dev Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run one shared Chrome container and one shared Meilisearch container for all local Karakeep worktrees while keeping SQLite/assets and Meilisearch indexes isolated per worktree.

**Architecture:** Add an optional `MEILI_INDEX_PREFIX` consumed by both Meilisearch plugins, then move Chrome/Meilisearch ownership from each workspace into a machine-level `scripts/dev-infra.sh` helper. Worktree setup keeps unique web/data state but points every workspace to localhost ports 7700/9222 and generates a stable per-worktree index prefix. `pnpm dev:start` ensures shared infra exists; `pnpm dev:stop` stops only current workspace processes.

**Tech Stack:** Bash, pnpm, Docker, Meilisearch, Karakeep Chrome, TypeScript, Zod, Vitest, GitHub Actions.

## Global Constraints

- Shared dev endpoints are `http://localhost:7700` for Meilisearch and `http://localhost:9222` for Chrome/CDP.
- Shared containers are machine-level and must not be stopped by an individual worktree.
- SQLite/assets remain isolated in each workspace's `.data/local`.
- `MEILI_INDEX_PREFIX` defaults to an empty string so production/installer/E2E behavior remains unchanged.
- Worktree prefixes must be safe Meilisearch UID components and unique across simultaneously configured worktrees.
- Use `ghcr.io/karakeep-app/karakeep-chrome:release`, not the retired GCR Alpine Chrome image.
- Shared infra ports must fail closed when occupied by a foreign process/container.
- No automatic garbage collection of old worktree indexes in this change.

---

### Task 1: Meilisearch index namespacing

**Files:**
- Create: `packages/plugins/lib/meiliIndexName.ts`
- Create: `packages/plugins/lib/meiliIndexName.test.ts`
- Modify: `packages/plugins/search-meilisearch/src/env.ts`
- Modify: `packages/plugins/search-meilisearch/src/index.ts`
- Modify: `packages/plugins/vectorstore-meilisearch/src/env.ts`
- Modify: `packages/plugins/vectorstore-meilisearch/src/index.ts`

**Interfaces:**
- Produces: `buildMeiliIndexName(baseName: string, prefix?: string): string`
- Consumes: optional `MEILI_INDEX_PREFIX` environment variable.

- [ ] **Step 1: Write failing unit tests**

```ts
import { describe, expect, it } from "vitest";
import { buildMeiliIndexName } from "./meiliIndexName";

describe("buildMeiliIndexName", () => {
  it("keeps existing index names when no prefix is configured", () => {
    expect(buildMeiliIndexName("bookmarks")).toBe("bookmarks");
    expect(buildMeiliIndexName("bookmarks_vectors", "")).toBe("bookmarks_vectors");
  });

  it("prefixes search and vector indexes consistently", () => {
    expect(buildMeiliIndexName("bookmarks", "issue-123_"))
      .toBe("issue-123_bookmarks");
    expect(buildMeiliIndexName("bookmarks_vectors", "issue-123_"))
      .toBe("issue-123_bookmarks_vectors");
  });
});
```

- [ ] **Step 2: Run plugin tests and confirm RED**

Run: `pnpm --filter @karakeep/plugins test --run`
Expected: FAIL because `./meiliIndexName` does not exist.

- [ ] **Step 3: Implement the helper and environment parsing**

```ts
export function buildMeiliIndexName(baseName: string, prefix = ""): string {
  return `${prefix}${baseName}`;
}
```

Add `MEILI_INDEX_PREFIX` with an empty default to both Meilisearch env parsers and construct provider index names through the helper.

- [ ] **Step 4: Run plugin tests/typecheck**

Run: `pnpm --filter @karakeep/plugins test --run && pnpm --filter @karakeep/plugins typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/plugins
git commit -m "feat: namespace Meilisearch indexes"
```

### Task 2: Shared machine-level development infrastructure

**Files:**
- Create: `scripts/dev-infra.sh`
- Create: `scripts/dev-infra.test.sh`
- Create: `.github/workflows/dev-workflow-tests.yml`

**Interfaces:**
- Produces: `scripts/dev-infra.sh up|status|down`
- Owns containers `karakeep-dev-meilisearch` and `karakeep-dev-chrome`.

- [ ] **Step 1: Write failing shell tests**

Tests use a fake `docker`/port probe and assert:
- `up` creates the two stable containers with Meili on 7700 and Chrome on 9222;
- repeated `up` reuses owned containers;
- foreign occupancy of either port fails with an actionable error;
- `down` removes only the two shared infra containers;
- Chrome image is `ghcr.io/karakeep-app/karakeep-chrome:release`;
- Bash syntax is valid.

- [ ] **Step 2: Run shell tests and confirm RED**

Run: `bash scripts/dev-infra.test.sh`
Expected: FAIL because `scripts/dev-infra.sh` does not exist.

- [ ] **Step 3: Implement `dev-infra.sh`**

The helper must:
- require Docker and daemon access;
- bind only localhost (`127.0.0.1:7700:7700`, `127.0.0.1:9222:9222`);
- use one persistent named Meili volume;
- recognize only its stable container names as owned endpoints;
- fail rather than assume compatibility when a port is occupied by anything else;
- make `up` idempotent and `down` explicit.

- [ ] **Step 4: Run shell tests**

Run: `bash -n scripts/dev-infra.sh && bash scripts/dev-infra.test.sh`
Expected: PASS.

- [ ] **Step 5: Add path-scoped GitHub Actions validation**

The workflow runs Bash syntax plus `scripts/dev-infra.test.sh` when shared-dev scripts/workflow change.

- [ ] **Step 6: Commit**

```bash
git add scripts/dev-infra.sh scripts/dev-infra.test.sh .github/workflows/dev-workflow-tests.yml
git commit -m "feat: add shared local dev infrastructure"
```

### Task 3: Worktree/start/stop integration

**Files:**
- Modify: `scripts/setup-worktree.sh`
- Modify: `start-dev.sh`
- Modify: `stop-dev.sh`
- Modify: `package.json`
- Extend: `scripts/dev-infra.test.sh`

**Interfaces:**
- Consumes: `scripts/dev-infra.sh up|status|down`.
- Produces package commands `dev:infra:up`, `dev:infra:status`, `dev:infra:down`.

- [ ] **Step 1: Add failing integration assertions**

Assert generated worktree `.env` contains:

```text
MEILI_ADDR=http://localhost:7700
BROWSER_WEB_URL=http://localhost:9222
MEILI_INDEX_PREFIX=<safe-workspace>-<WT_PORT_BASE>_
```

and no longer derives Meili/Chrome ports from `WT_PORT_BASE`. Assert `start-dev.sh` delegates infra startup and `stop-dev.sh` contains no shared-container stop/remove operation.

- [ ] **Step 2: Run shell tests and confirm RED**

Run: `bash scripts/dev-infra.test.sh`
Expected: FAIL against current per-worktree infrastructure behavior.

- [ ] **Step 3: Update worktree setup**

Keep unique web port/data URL behavior, write shared endpoints, and derive a sanitized prefix from `WT_WORKSPACE_NAME` plus `WT_PORT_BASE`. The main workspace defaults to `main_` when no generated prefix exists.

- [ ] **Step 4: Update start/stop lifecycle**

`start-dev.sh` invokes `scripts/dev-infra.sh up`, then starts only web/workers and migrations. `stop-dev.sh` kills only current workspace processes and prints how to stop shared infra explicitly.

- [ ] **Step 5: Add package scripts**

```json
"dev:infra:up": "bash scripts/dev-infra.sh up",
"dev:infra:status": "bash scripts/dev-infra.sh status",
"dev:infra:down": "bash scripts/dev-infra.sh down"
```

- [ ] **Step 6: Run shell tests and syntax checks**

Run: `bash -n start-dev.sh stop-dev.sh scripts/setup-worktree.sh scripts/dev-infra.sh && bash scripts/dev-infra.test.sh`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json start-dev.sh stop-dev.sh scripts/setup-worktree.sh scripts/dev-infra.test.sh
git commit -m "feat: reuse dev infrastructure across worktrees"
```

### Task 4: Documentation and assistant guidance

**Files:**
- Modify: `docs/operator-setup.md`
- Modify: `AGENTS.md`
- Modify: PR description after implementation.

**Interfaces:**
- Documents the exact commands and lifecycle implemented in Tasks 1-3.

- [ ] **Step 1: Update fork developer docs**

Document shared infra architecture, `dev:infra:*` commands, automatic infra startup from `dev:start`, per-worktree SQLite/assets isolation, `MEILI_INDEX_PREFIX`, and the fact that `dev:stop` leaves shared infra running.

- [ ] **Step 2: Update AGENTS.md**

Keep the assistant-facing local-dev summary aligned with `docs/operator-setup.md`; do not change production installer guidance.

- [ ] **Step 3: Check CLAUDE/GEMINI representation**

If they are references/symlinks to `AGENTS.md`, do not duplicate edits. If independent copies, update them consistently.

- [ ] **Step 4: Commit**

```bash
git add docs/operator-setup.md AGENTS.md
git commit -m "docs: explain shared worktree dev infrastructure"
```

### Task 5: Full validation and PR readiness

**Files:**
- Review all PR #32 changed files.

- [ ] **Step 1: Run focused validation**

```bash
pnpm --filter @karakeep/plugins test --run
pnpm --filter @karakeep/plugins typecheck
bash -n start-dev.sh stop-dev.sh scripts/setup-worktree.sh scripts/dev-infra.sh
bash scripts/dev-infra.test.sh
```

- [ ] **Step 2: Run repository quality checks**

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

- [ ] **Step 3: Inspect PR diff for scope/secrets**

Confirm production/installer behavior stays unchanged, no credentials are present, and only local-dev Meili indexes are namespaced when the prefix is set.

- [ ] **Step 4: Update PR #32 description and mark ready**

Summarize architecture, validation, and backward compatibility. Keep base branch `main`.

- [ ] **Step 5: Inspect current GitHub Actions**

Do not call the PR complete until the current head's required CI and new dev-workflow tests are green, or report the exact blocker from logs.
