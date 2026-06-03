# Karakeep Project Overview

This document provides context about the Karakeep project for the different agents.

## Project Overview

Karakeep is a monorepo project managed with Turborepo. It is a "read-it-later" bookmarking application with a focus on collecting and organizing information. The project is built with a modern tech stack, including:

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Hono (a lightweight web framework), tRPC
- **Database:** Drizzle ORM over SQLite (`better-sqlite3`); the DB file and assets live under `DATA_DIR`
- **Tooling:** Oxfmt, oxlint, Vitest, pnpm

## Fork notes

This repo is an **opinionated personal fork** of Karakeep (`origin`: `absolutepraya/karakeep`, `upstream`: `karakeep-app/karakeep`) focused on UX/QoL changes while staying close to upstream. Full setup details live in [`docs/abhip-fork-setup.md`](docs/abhip-fork-setup.md).

### Local dev (one command)

Node 24 (`.nvmrc`) + `pnpm@11.2.1` via corepack. First-time setup: `pnpm install`, then symlink the root `.env` into `apps/web`, `apps/workers`, and `packages/db` (each process loads `.env` from its own CWD), then `pnpm db:migrate`.

- `./start-dev.sh` — foreground (Ctrl+C stops everything); `./start-dev.sh -d` — detached (logs in `.dev/`, frees the shell), stop with `./stop-dev.sh`. Runs `web`+`workers` natively and Meilisearch+Chrome in Docker.
- Or run pieces directly: `pnpm web` (:3000) + `pnpm workers`. Meilisearch (search) and headless Chrome (crawling) are optional — the web app boots and degrades gracefully without them.
- Gotcha: if `next dev` crashes at boot with `instrumentation.ts ... MODULE_UNPARSABLE`, clear the stale Turbopack cache with `rm -rf apps/web/.next` (it gets seeded by `next typegen`, which `pnpm typecheck` runs).

### Deploy (pull-based)

CI green on `main` → `.github/workflows/docker.yml` builds + pushes the public image `ghcr.io/<owner>/karakeep:main` → a Watchtower container on the VPS polls GHCR and redeploys. No inbound SSH (the VPS firewalls SSH to Tailscale). The canonical compose is `deploy/docker-compose.prod.yml`.

## Project Structure

The project is organized into `apps` and `packages`:

### Applications (`apps/`)

- **`web`:** The main web application, built with Next.js.
- **`browser-extension`:** A browser extension, likely for saving content to karakeep.
- **`cli`:** A command-line interface for interacting with the service.
- **`landing`:** A landing page for the project.
- **`mobile`:** A mobile application (details unknown).
- **`mcp`:** The Model Context Protocol (MCP) server to communicate with Karakeep.
- **`workers`:** Background workers for processing tasks.

### Packages (`packages/`)

- **`api`:** The main API, built with Hono and tRPC.
- **`db`:** Database schema and migrations, using Drizzle ORM.
- **`e2e_tests`:** End-to-end tests for the project.
- **`open-api`:** OpenAPI specifications for the API.
- **`sdk`:** A software development kit for interacting with the API.
- **`shared`:** Shared code and types between packages.
- **`shared-react`:** Shared React components and hooks.
- **`shared-server`:** Shared logic that's meant to be used on the server-side.
- **`trpc`:** tRPC router and procedures. Most of the business logic is here.

### Docs

- **docs/docs/03-configuration.md**: Explains configuration options for the project.

## Development Workflow

- **Package Manager:** pnpm
- **Build System:** Turborepo
- **Code Formatting:** Oxfmt
- **Linting:** oxlint
- **Testing:** Vitest

## Other info

- This project uses shadcn/ui. The shadcn components in the web app are in `apps/web/components/ui`.
- This project uses Tailwind CSS.
- For the mobile app, we use [expo](https://expo.dev/).

### Common Commands

- `pnpm typecheck`: Typecheck the codebase.
- `pnpm lint`: Lint the codebase.
- `pnpm lint:fix`: Fix linting issues.
- `pnpm format`: Format the codebase.
- `pnpm format:fix`: Fix formatting issues.
- `pnpm test`: Run tests.
- `pnpm db:generate --name description_of_schema_change`: db migration after making schema changes

Starting services:
- `pnpm web`: Start the web application (this doesn't return, unless you kill it).
- `pnpm workers`: Starts the background workers (this doesn't return, unless you kill it).
