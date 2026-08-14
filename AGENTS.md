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

## Durable identifiers

Preserve package scopes, database paths, export-format names, `KARAKEEP_` variables, Compose service names, GHCR image paths, and Docker-network names. These are operations and compatibility identifiers, not product presentation.

The fork deploys through CI-built GHCR images and VPS Watchtower polling. The canonical production compose is `deploy/docker-compose.prod.yml`; use `docs/fork-setup.md` for the complete operator workflow.
