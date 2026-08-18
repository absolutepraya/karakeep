# Docs site

This directory contains the Docusaurus docs site for Marka.

## What lives here

- `docs/docs/**` — docs content pages
- `docs/api/**` — generated API docs
- `docusaurus.config.ts` — site configuration
- `sidebars.ts` — sidebar configuration
- `src/**` — theme/custom UI for the docs site
- `static/**` — static assets

## Documentation model used in this repo

This repository keeps two related but distinct documentation layers:

1. **Repository documentation map**
   - `README.md` is the public product framing.
   - `CONTRIBUTING.md` contains contribution rules.
   - `docs/operator-setup.md` contains Marka operator setup.
   - `docs/README.md` contains docs-site development.
   - `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` provide concise assistant operations context.

2. **Docs site content**
   - end-user and developer docs under `docs/docs/**`
   - generated API docs under `docs/api/**`

The docs-site configuration and hosted presentation remain owned by deferred docs work. Keep historical and upstream product context intact while documenting Marka development and operator workflow where relevant.

## Install

From the repository root:

```bash
pnpm install
```

You usually do **not** need a separate install inside `docs/`.

## Local development

Run the docs site from the repository root:

```bash
pnpm --filter @karakeep/docs start
```

Useful related commands:

```bash
pnpm --filter @karakeep/docs build
pnpm --filter @karakeep/docs serve
pnpm --filter @karakeep/docs clear
pnpm --filter @karakeep/docs typecheck
```

## API docs generation

The docs site includes generated API reference material.

Regenerate it with:

```bash
pnpm --filter @karakeep/docs gen-api
```

This reads from:
- `packages/open-api/karakeep-openapi-spec.json`

and writes to:
- `docs/docs/api/**`

## When editing docs

If you change Marka development or deployment facts, keep the repo docs and docs-site pages aligned.

At minimum, check:
- `README.md`
- `CONTRIBUTING.md`
- `docs/operator-setup.md`
- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- relevant pages under `docs/docs/**`

## Validation

For documentation-only changes, the most useful checks are:

```bash
pnpm --filter @karakeep/docs typecheck
pnpm --filter @karakeep/docs build
```

For repo-wide consistency after larger docs rewrites, also run:

```bash
pnpm lint
pnpm typecheck
```
