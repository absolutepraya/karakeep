# Directory structure

This repository is a pnpm workspace / Turborepo monorepo.

## Top-level areas

| Path | Purpose |
| --- | --- |
| `apps/` | User-facing apps and services |
| `packages/` | Shared libraries, API/schema packages, SDK, and server logic |
| `docs/` | Docusaurus docs site |
| `deploy/` | Production compose and deploy-oriented assets for this fork |
| `docker/` | Local/dev Docker Compose assets |
| `tooling/` | Shared config packages and repository tooling |
| `.github/` | CI/CD workflows |

## Apps

| Directory | Description |
| --- | --- |
| `apps/web` | Main Next.js web application |
| `apps/workers` | Background workers for crawling, inference, indexing, feeds, backups, and related jobs |
| `apps/browser-extension` | Browser extension for saving into Karakeep |
| `apps/mobile` | Expo mobile application |
| `apps/landing` | Marketing / landing site |
| `apps/mcp` | MCP server for external agent/tool integrations |

## Packages

| Directory | Description |
| --- | --- |
| `packages/trpc` | Most business logic, routers, and procedures |
| `packages/db` | Database schema and migrations |
| `packages/shared` | Shared types, config, helpers, and utilities |
| `packages/shared-react` | Shared React hooks/components |
| `packages/shared-server` | Shared server-only code |
| `packages/open-api` | OpenAPI spec generation/output |
| `packages/sdk` | TypeScript SDK |
| `packages/benchmarks` | Benchmark tooling for performance checks |

## Docs and operator files

| Path | Description |
| --- | --- |
| `README.md` | Public repo overview for this fork |
| `CONTRIBUTING.md` | Contribution guidance for this repo |
| `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` | Internal assistant-facing repo context |
| `docs/fork-setup.md` | Canonical fork-specific local dev / deploy notes |
| `docs/docs/**` | Docs-site content |

## Tooling

| Directory | Description |
| --- | --- |
| `tooling/typescript` | Shared TypeScript configuration |
| `tooling/oxlint` | Lint tooling/config assets |
| `tooling/prettier` | Prettier-related workspace package |
| `tooling/tailwind` | Shared Tailwind configuration |
| `tooling/github` | GitHub-related helper tooling |

## Where to look first

- UI work usually starts in `apps/web`
- background job behavior usually lives across `apps/workers` + `packages/trpc`
- schema changes start in `packages/db`
- shared types/config/helpers usually live in `packages/shared`
- repo-specific dev/deploy behavior is documented in `docs/fork-setup.md`
