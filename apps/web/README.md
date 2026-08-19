# `@karakeep/web`

This is the main Next.js web application for Marka.

## What lives here

- authenticated dashboard UI
- public list pages
- settings and admin surfaces
- server-rendered web routes
- most user-facing interactions for saving, browsing, and retrieving bookmarks

## Local development

From the repository root, the usual entrypoint is:

```bash
pnpm web
```

In this fork, the preferred full-stack workflow is still:

```bash
./start-dev.sh
```

That brings up:
- the web app
- workers
- Meilisearch
- headless Chrome

## Useful commands

From the repository root:

```bash
pnpm --filter @karakeep/web dev
pnpm --filter @karakeep/web build
pnpm --filter @karakeep/web start
pnpm --filter @karakeep/web lint
pnpm --filter @karakeep/web format:fix
pnpm --filter @karakeep/web typecheck
pnpm --filter @karakeep/web test
```

## Notes

- The app reads `.env` from its own working directory, so this repo symlinks the root `.env` into `apps/web/.env`.
- Search requires Meilisearch.
- Crawling and several background-driven features require the workers.
- If local dev crashes with a stale Turbopack/instrumentation issue, clearing `apps/web/.next` is often enough.
