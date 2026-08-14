# Marka assistant context

`absolutepraya/karakeep` is the Marka fork. The upstream Karakeep project is <https://github.com/karakeep-app/karakeep>.

## Authoritative documentation map

- `README.md`: public fork framing
- `CONTRIBUTING.md`: contribution rules
- `docs/fork-setup.md`: fork operation, local development, and deployment
- `docs/README.md`: docs-site development
- This file, `CLAUDE.md`, and `GEMINI.md`: concise assistant operations context

## Repository operations

- Monorepo: Next.js, React, TypeScript, Hono, tRPC, Drizzle, SQLite, Meilisearch, pnpm, and Turborepo.
- Runtime: Node 24 through `mise exec node@24 --`; pnpm 11.2.1 through Corepack.
- Install with `pnpm install`, create the documented `.env` symlinks, then run `pnpm db:migrate`.
- Start local development with `pnpm dev:start`. Use `pnpm dev:start -d` for detached mode and `pnpm dev:stop` to stop it.
- Run focused checks before broad checks when practical. Standard checks are `pnpm format:fix`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Root `.env` is canonical. Do not print or commit secrets.
- Guided Docker self-hosting: `docs/docs/02-installation/11-guided-docker-setup.md`.

## Durable identifiers

Preserve package scopes, database paths, export-format names, `KARAKEEP_` variables, Compose service names, GHCR image paths, and Docker-network names. These are operations and compatibility identifiers, not product presentation.

The fork deploys through CI-built GHCR images and VPS Watchtower polling. The canonical production compose is `deploy/docker-compose.prod.yml`; use `docs/fork-setup.md` for the complete operator workflow.

Karakeep is a monorepo bookmark-everything app for saving and retrieving links, notes, images, PDFs, highlights, and archived pages.

Main stack:
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **API:** Hono + tRPC
- **Database:** Drizzle ORM over SQLite (`better-sqlite3`)
- **Search:** Meilisearch
- **Tooling:** pnpm, Turborepo, oxfmt, oxlint, Vitest

## Repo structure

### Apps
- `apps/web` - main web application
- `apps/workers` - background workers
- `apps/browser-extension` - browser extension
- `apps/mobile` - Expo mobile app
- `apps/landing` - marketing / landing site
- `apps/mcp` - MCP server

### Packages
- `packages/trpc` - core business logic and routers
- `packages/db` - schema and migrations
- `packages/shared` - shared code and types
- `packages/shared-react` - shared React helpers/components
- `packages/shared-server` - shared server-only logic
- `packages/open-api` - OpenAPI artifacts
- `packages/sdk` - TypeScript SDK

## Guided self-host deployment

The preferred portable setup for a new self-hosted instance is `scripts/install.sh`. The public one-line entry point is:

```bash
curl -fsSLo /tmp/karakeep-setup.sh https://raw.githubusercontent.com/absolutepraya/karakeep/main/scripts/install.sh && bash /tmp/karakeep-setup.sh
```

Important installer facts:

- supported host scope is Linux `amd64` with Docker Engine, Docker Compose v2, and OpenSSL already installed
- the script never installs Docker, changes firewall rules, configures DNS, or provisions TLS/reverse-proxy infrastructure
- default configuration directory is `~/karakeep`; default persistent data directory is `~/karakeep/data`
- generated Compose project name is `karakeep`
- generated app images are the paired `ghcr.io/absolutepraya/karakeep:web-main` and `ghcr.io/absolutepraya/karakeep:workers-main` tags
- the default web listener is `127.0.0.1:3000`, intended to sit behind an operator-managed reverse proxy for Internet-facing installs
- search choices are managed Meilisearch, external Meilisearch, or disabled search
- renderer choices are managed private Chrome, external token-protected Browserless, or disabled browser rendering
- AI choices are disabled, OpenAI-compatible, or deferred
- non-interactive installs require explicit deployment choices and accept secrets only through environment variables, never command-line flags
- generated `app.env`, `workers.env`, and `.data-dir` files use restrictive permissions and secrets must never be printed or committed
- a normal rerun refuses to overwrite generated config; `--reconfigure` first creates a timestamped config backup
- `uninstall` removes containers/network only and deliberately preserves configuration and persistent data
- the generated helper supports `status`, `backup`, `update`, `start`, `stop`, and `uninstall`

Use an immutable release tag or commit SHA instead of `main` in the raw URL when reproducibility is required. The full installer contract and non-interactive examples are in `docs/docs/02-installation/11-guided-docker-setup.md`.

Validate installer changes with:

```bash
bash scripts/install.test.sh
```

## Local development for this fork

### Runtime
- Node 24 (`.nvmrc`)
- `pnpm@11.2.1` via corepack

### First-time setup

```bash
pnpm install

ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/workers/.env
ln -sf ../../.env packages/db/.env

pnpm db:migrate
```

### Preferred start command

```bash
pnpm dev:start
```

Useful variants:
- `pnpm dev:start` - foreground
- `pnpm dev:start -d` - detached
- `pnpm dev:stop` - stop detached services

What it does:
- runs `web` + `workers` natively
- runs Meilisearch + headless Chrome in Docker

### Direct commands

```bash
pnpm web
pnpm workers
```

Notes:
- Meilisearch and headless Chrome are optional for booting the app, but required for full search/crawling behavior.
- If `next dev` crashes with a stale Turbopack/instrumentation issue, clear `apps/web/.next`.

### Pull prod state to local dev

Use `pnpm prod:pull-state` for production-to-local state pulls from the VPS. It reads root `.env` and replaces local development state by default. Use `pnpm prod:pull-state --dry-run` to inspect the plan without changing local state.

Required root `.env` keys:
- `DATA_DIR`
- `KARAKEEP_PROD_SSH_HOST`
- `KARAKEEP_PROD_COMPOSE_DIR`

Optional root `.env` keys:
- `KARAKEEP_PROD_SSH_USER`
- `KARAKEEP_PROD_COMPOSE_SERVICE`
- `KARAKEEP_PROD_EXPORT_IMAGE`

Every pull restores the full `/data` volume because SQLite rows can reference stored assets. Do not use DB-only pulls or print `.env` secrets.

## Deploy model for this fork

This fork uses a **pull-based** personal VPS deploy flow that is separate from the portable guided installer.

High-level flow:
- CI passes on `main`
- `.github/workflows/docker.yml` builds and pushes matching `ghcr.io/<owner>/karakeep:web-main` and `ghcr.io/<owner>/karakeep:workers-main` images from the same successful commit
- a Watchtower container on the VPS polls the paired GHCR tags and redeploys automatically

Important notes:
- no inbound SSH push-deploy from CI
- canonical personal VPS compose: `deploy/docker-compose.prod.yml`
- the guided installer generates its own portable Compose file and does not add Watchtower automatically
- details for the existing personal VPS live in `docs/fork-setup.md`

## Quality / maintenance tooling

Standard commands:
- `pnpm format:fix`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

Additional tooling used in this fork:
- `pnpm knip` - unused files / deps / exports
- `pnpm doctor` - React health scan via react.doctor
- `pnpm doctor:staged` - staged-file React scan
- `bash scripts/install.test.sh` - guided installer shell-level validation

Notes:
- `react.doctor` is advisory in pre-commit and can emit noisy temp-package errors.
- **Biome is intentionally not used** in this repo.
- `react-grab` is loaded in dev-only mode in the web app.

## Documentation guidance

This repo's docs are intentionally split into audiences:
- **public/repo-facing** docs explain Karakeep plus this fork's repo identity
- **assistant docs** summarize the same fork facts for tooling
- **guided self-host docs** define the portable Docker installer contract
- **operator docs** capture the existing personal VPS deploy/dev workflow of this fork

If you edit fork/dev/deploy facts, keep these aligned:
- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `docs/fork-setup.md`
- `docs/docs/02-installation/11-guided-docker-setup.md`
- relevant pages under `docs/docs/**`

## Common commands

```bash
pnpm format:fix
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm doctor
bash scripts/install.test.sh
pnpm db:generate --name <description>
pnpm db:migrate
pnpm web
pnpm workers
```

## Working style for assistants

- Prefer repo-specific facts over generic upstream assumptions.
- Use the guided Docker setup doc for portable fresh-host installation answers.
- Use `docs/fork-setup.md` for this fork's local-dev and existing personal VPS deployment answers.
- Treat upstream docs as product context, not as authoritative for this fork's operational workflow.
- When changing documentation, avoid leaving split or contradictory setup instructions; rewrite for coherence.
