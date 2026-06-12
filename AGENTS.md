# Karakeep fork overview

This repository is an **opinionated personal fork** of upstream Karakeep.

- **Origin:** `absolutepraya/karakeep`
- **Upstream:** `karakeep-app/karakeep`
- **Focus:** UX/QoL improvements, tighter local-dev ergonomics, and a personal operator workflow while staying reasonably close to upstream

## Canonical sources

When facts conflict, use these as the source of truth:

- **Public repo framing:** `README.md`
- **Contribution expectations:** `CONTRIBUTING.md`
- **Fork-specific local dev / deploy / operator workflow:** `docs/fork-setup.md`
- **Docs-site workflow:** `docs/README.md`

Keep this file aligned with `AGENTS.md` and `CLAUDE.md`.

## Project overview

Karakeep is a monorepo bookmark-everything app for saving and retrieving links, notes, images, PDFs, highlights, and archived pages.

Main stack:
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **API:** Hono + tRPC
- **Database:** Drizzle ORM over SQLite (`better-sqlite3`)
- **Search:** Meilisearch
- **Tooling:** pnpm, Turborepo, oxfmt, oxlint, Vitest

## Repo structure

### Apps
- `apps/web` — main web application
- `apps/workers` — background workers
- `apps/browser-extension` — browser extension
- `apps/mobile` — Expo mobile app
- `apps/landing` — marketing / landing site
- `apps/mcp` — MCP server

### Packages
- `packages/trpc` — core business logic and routers
- `packages/db` — schema and migrations
- `packages/shared` — shared code and types
- `packages/shared-react` — shared React helpers/components
- `packages/shared-server` — shared server-only logic
- `packages/open-api` — OpenAPI artifacts
- `packages/sdk` — TypeScript SDK

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
./start-dev.sh
```

Useful variants:
- `./start-dev.sh` — foreground
- `./start-dev.sh -d` — detached
- `./stop-dev.sh` — stop detached services

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

## Deploy model for this fork

This fork uses a **pull-based** deploy flow.

High-level flow:
- CI passes on `main`
- `.github/workflows/docker.yml` builds and pushes `ghcr.io/<owner>/karakeep:main`
- a Watchtower container on the VPS polls GHCR and redeploys automatically

Important notes:
- no inbound SSH push-deploy from CI
- canonical production compose: `deploy/docker-compose.prod.yml`
- details live in `docs/fork-setup.md`

## Quality / maintenance tooling

Standard commands:
- `pnpm format:fix`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

Additional tooling used in this fork:
- `pnpm knip` — unused files / deps / exports
- `pnpm doctor` — React health scan via react.doctor
- `pnpm doctor:staged` — staged-file React scan

Notes:
- `react.doctor` is advisory in pre-commit and can emit noisy temp-package errors.
- **Biome is intentionally not used** in this repo.
- `react-grab` is loaded in dev-only mode in the web app.

## Documentation guidance

This repo’s docs are intentionally split into audiences:
- **public/repo-facing** docs explain Karakeep plus this fork’s repo identity
- **assistant docs** summarize the same fork facts for tooling
- **operator docs** capture the real deploy/dev workflow of this fork

If you edit fork/dev/deploy facts, keep these aligned:
- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `docs/fork-setup.md`
- relevant pages under `docs/docs/**`

## Common commands

```bash
pnpm format:fix
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm doctor
pnpm db:generate --name <description>
pnpm db:migrate
pnpm web
pnpm workers
```

## Working style for assistants

- Prefer repo-specific facts over generic upstream assumptions.
- Use `docs/fork-setup.md` for local-dev/deploy/operator answers.
- Treat upstream docs as product context, not as authoritative for this fork’s operational workflow.
- When changing documentation, avoid leaving “see upstream below” splits; rewrite for coherence.
