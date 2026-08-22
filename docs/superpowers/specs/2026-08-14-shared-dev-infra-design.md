# Shared Local Dev Infrastructure Across Marka Worktrees

## Goal

Reduce duplicated local development infrastructure when multiple Marka worktrees run at the same time, while preserving per-worktree application/data isolation.

The desired local model is:

- one shared headless Chrome container per developer machine
- one shared Meilisearch container per developer machine
- one web process, workers process, SQLite/data directory, and Meilisearch index namespace per worktree
- stopping one worktree must not stop infrastructure still used by other worktrees

This design is local-development-specific. It does not change the guided production installer or production service-isolation guidance.

## Current behavior

The selected implementation uses one machine-level Meilisearch container and one machine-level Chrome container. `scripts/setup-worktree.sh` assigns a unique web port and Meilisearch namespace to each worktree. `stop-dev.sh` stops only the current worktree's web and workers processes.

Application data is already isolated per worktree through `.data/local`.

The Meilisearch plugins currently use fixed index UIDs:

- search: `bookmarks`
- vector store: `bookmarks_vectors`

Because different worktrees have different SQLite state, multiple worktrees cannot safely share one Meilisearch server unless those index UIDs are namespaced.

## Approaches considered

### 1. Keep dedicated infrastructure per worktree

This preserves strong isolation and requires no application changes, but every worktree consumes an additional Chrome and Meilisearch container. It scales poorly for parallel worktree development and keeps duplicated local state that is not valuable.

### 2. Share Chrome and Meilisearch without namespacing

This minimizes container count, but is unsafe. Every worktree would write to the same `bookmarks` and `bookmarks_vectors` indexes while using a different SQLite database. Reindexing, deletions, settings updates, and vector data would cross worktree boundaries.

### 3. Share physical infrastructure and namespace Meilisearch indexes

**Selected approach.** Chrome is naturally shareable for local development because each worker creates browser contexts within the shared browser process. Meilisearch is shared at the server/container level while each worktree receives distinct index UIDs. SQLite/assets remain worktree-local.

This gives the resource benefit of shared infrastructure without mixing application state.

## Architecture

The machine-level infrastructure owns two stable endpoints:

- Chrome/CDP: `http://127.0.0.1:9250`
- Meilisearch: `http://127.0.0.1:7700`

Each worktree receives:

- a unique web port, as today
- `BROWSER_WEB_URL=http://127.0.0.1:9250`
- `MEILI_ADDR=http://127.0.0.1:7700`
- a unique `MEILI_INDEX_PREFIX`
- its own `.data/local` directory

Example:

```text
shared dev infra
├── Chrome :9250
└── Meilisearch :7700
    ├── main_bookmarks
    ├── main_bookmarks_vectors
    ├── issue-123-1_bookmarks
    ├── issue-123-1_bookmarks_vectors
    ├── feature-x-2_bookmarks
    └── feature-x-2_bookmarks_vectors

worktree main
├── web :3000
├── workers
└── .data/local

worktree issue-123
├── web :3001
├── workers
└── .data/local
```

## Meilisearch index namespace

Introduce an optional environment variable:

```text
MEILI_INDEX_PREFIX
```

Default: empty string.

This preserves all existing production/upstream-compatible behavior when unset:

```text
bookmarks
bookmarks_vectors
```

When set to `issue-123-1_`, the plugins use:

```text
issue-123-1_bookmarks
issue-123-1_bookmarks_vectors
```

Both the search Meilisearch plugin and vector-store Meilisearch plugin must consume the same prefix source.

The prefix is an index namespace only. It does not change `MEILI_ADDR`, credentials, or server-level configuration.

### Worktree prefix generation

`scripts/setup-worktree.sh` derives a stable safe slug from the worktree identity and combines it with `WT_PORT_BASE`, which is already unique per configured worktree. It writes:

```text
MEILI_INDEX_PREFIX=<workspace-slug>-<port-base>_
```

Using both values prevents collisions when two workspace names normalize to the same slug. Unsupported characters are normalized to `-`; secrets and absolute paths are never included.

The main workspace uses a stable `main_` prefix so it cannot collide with worktrees while sharing the same server. `start-dev.sh` supplies `main_` only when `MEILI_INDEX_PREFIX` is otherwise unset, so an explicit developer override remains possible.

## Shared infrastructure lifecycle

Add a dedicated machine-level helper, `scripts/dev-infra.sh`, and expose it through package scripts:

```bash
pnpm dev:infra:up
pnpm dev:infra:status
pnpm dev:infra:down
```

The helper owns stable container names:

```text
marka-dev-meilisearch
marka-dev-chrome
```

It starts:

- `getmeili/meilisearch:v1.41.0` on host port `7700`
- `ghcr.io/karakeep-app/karakeep-chrome:release` on host port `9250`, forwarding to the container's CDP port `9222`

Chrome must use the maintained Karakeep image/configuration rather than the retired `gcr.io/zenika-hub/alpine-chrome:124` image.

The shared Meilisearch container keeps one machine-level Docker volume so index state survives restarts. Individual worktree indexes remain logically isolated within it.

`dev:infra:down` is an explicit machine-level action. Individual worktree stop commands must never call it automatically.

## `start-dev.sh` behavior

`pnpm dev:start` remains the preferred developer entry point.

Before starting web/workers, it should:

1. verify Docker and pnpm prerequisites as today
2. ensure shared dev infrastructure is running, starting it through `scripts/dev-infra.sh up` when needed
3. use the workspace's `MEILI_ADDR`, `BROWSER_WEB_URL`, and `MEILI_INDEX_PREFIX`
4. for the main workspace only, default an unset `MEILI_INDEX_PREFIX` to `main_`
5. run migrations against that workspace's isolated data directory
6. start only that workspace's web and workers processes

It must not create worktree-specific Chrome or Meilisearch containers.

The shared endpoints default to `127.0.0.1:7700` and `127.0.0.1:9250`. Explicit `.env` overrides remain possible, but when the default shared endpoints are used they must be owned by the shared-infra helper rather than an unrelated process. IPv4 loopback is intentional because the container publishes on `127.0.0.1` and the worker connects over CDP.

## `stop-dev.sh` behavior

`pnpm dev:stop` stops only the current workspace's web/workers processes and removes their pidfiles.

It must not stop or remove shared Chrome or Meilisearch.

The output should tell the developer that shared infrastructure remains running and can be stopped explicitly with:

```bash
pnpm dev:infra:down
```

## Worktree setup behavior

`scripts/setup-worktree.sh` continues to isolate:

- web port
- `DATA_DIR`
- `API_URL`
- `NEXTAUTH_URL`

It no longer allocates per-worktree Meilisearch or Chrome ports. Every generated worktree `.env` points to:

```text
MEILI_ADDR=http://127.0.0.1:7700
BROWSER_WEB_URL=http://127.0.0.1:9250
MEILI_INDEX_PREFIX=<workspace-slug>-<port-base>_
```

Production-state pulls remain per-worktree because the SQLite/assets directory remains isolated. A pulled production snapshot does not imply sharing local Meilisearch indexes; the worktree's own index can be rebuilt from its local application state.

## Port/conflict handling

The shared infra helper must fail clearly if ports `7700` or `9250` are already occupied by a process/container it does not own instead of silently assuming compatibility.

If the expected Karakeep shared container already owns the port, `up` is idempotent and reuses it.

This avoids accidentally connecting development worktrees to an unrelated local Meilisearch or CDP endpoint.

## Backward compatibility

`MEILI_INDEX_PREFIX` is optional and defaults to empty, so production, E2E, installer-generated deployments, and users who do not use the fork's worktree helpers keep the existing `bookmarks` / `bookmarks_vectors` names.

The shared-infra behavior is limited to this fork's local development scripts and docs.

## Tests

Add focused regression coverage for:

1. search plugin index UID defaults to `bookmarks` when no prefix is set
2. search plugin applies `MEILI_INDEX_PREFIX`
3. vector plugin defaults to `bookmarks_vectors`
4. vector plugin applies the same prefix
5. worktree setup produces shared Meili/Chrome endpoints and a unique index prefix while retaining isolated web/data values
6. `start-dev.sh` delegates shared infra startup instead of creating per-worktree infra containers
7. `stop-dev.sh` does not stop/remove shared infrastructure
8. shared infra helper is idempotent for its own containers and rejects foreign port conflicts
9. Bash syntax validation for modified shell scripts

Where existing test structure makes direct shell invocation awkward, extract small pure shell helpers rather than weakening assertions.

## Documentation

Update the canonical fork-development documentation:

- `docs/operator-setup.md`
- `AGENTS.md`

Document:

- two shared infra containers per machine regardless of worktree count
- per-worktree SQLite/assets and Meilisearch index namespaces
- `pnpm dev:start` / `pnpm dev:stop` lifecycle
- `pnpm dev:infra:up`, `pnpm dev:infra:status`, and `pnpm dev:infra:down`
- `MEILI_INDEX_PREFIX` and its backward-compatible default

Update `CLAUDE.md` / `GEMINI.md` only if they are independent copies rather than references to `AGENTS.md`.

## Non-goals

- sharing SQLite or asset directories between worktrees
- sharing one un-namespaced Meilisearch index between worktrees
- changing production or guided-installer service ownership
- introducing automatic garbage collection of old worktree indexes in this PR
- exposing Chrome/Meilisearch beyond loopback
- adding orchestration beyond the existing Bash/pnpm developer workflow

## Success criteria

With three simultaneous local worktrees:

- exactly one shared Chrome container and one shared Meilisearch container are needed
- each worktree has an independent web port and SQLite/assets state
- each worktree uses distinct Meilisearch search/vector indexes
- stopping one worktree leaves the other worktrees and shared infra running
- normal deployments remain unaffected when `MEILI_INDEX_PREFIX` is unset
