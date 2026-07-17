# Contributing

Thanks for taking the time to improve Karakeep.

This repository is an **opinionated personal fork** of upstream Karakeep, so contribution flow here is a little different from the main project.

## Which repo should you contribute to?

### Contribute to upstream Karakeep if...
- your change is generally useful to the main project
- it is not specific to this fork’s UX/QoL direction
- it affects the broader community-facing product, install flow, or platform support

Start here:
- Upstream repo: <https://github.com/karakeep-app/karakeep>
- Upstream docs: <https://docs.karakeep.app>

### Contribute to this fork if...
- the change is specific to this fork’s UX, operator workflow, or repo-specific maintenance model
- it depends on this fork’s pull-based deploy flow or local-dev scripts
- it intentionally diverges from upstream behavior or presentation

## Before you start

- Open an issue or discussion first if the change is large, behavioral, or opinionated.
- If the change probably belongs upstream, prefer proposing it there instead of here.
- Read the fork-specific setup guide: [`docs/fork-setup.md`](docs/fork-setup.md)

## Local setup

This fork uses:
- Node 24 (`.nvmrc`)
- `pnpm@11.2.1` via corepack
- root `.env` symlinked into `apps/web`, `apps/workers`, and `packages/db`

Quick start:

```bash
pnpm install

ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/workers/.env
ln -sf ../../.env packages/db/.env

pnpm db:migrate
./start-dev.sh
```

For the full workflow, detached mode, and production deploy notes, use:
- [`docs/fork-setup.md`](docs/fork-setup.md)

## What to run before opening a PR

At minimum:

```bash
pnpm format:fix
pnpm lint
pnpm typecheck
```

Depending on the change, also run:

```bash
pnpm test
pnpm knip
pnpm doctor
pnpm doctor:staged
```

Notes:
- `pnpm doctor` and `pnpm doctor:staged` are advisory local checks. CI requires a React Doctor score of at least 99 through `pnpm doctor:ci`; see [`docs/react-doctor.md`](docs/react-doctor.md) for the baseline and accepted tool limitations.
- `knip` is useful for repository cleanup, but is non-blocking in CI.

## Change expectations

### UI / UX changes
- Include screenshots or a short screen recording.
- Explain why the change fits this fork specifically.
- Keep the design language consistent with the current app rather than introducing a second style system.

### Schema / backend changes
- Add migrations when needed.
- Call out any deploy or operator impact clearly.
- Mention if a change would make upstream sync harder.

### Documentation changes
If you touch fork/dev/deploy facts, keep the relevant docs aligned:
- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `docs/fork-setup.md`
- relevant docs-site pages under `docs/docs/**`

## PR guidance

A good PR for this repo should include:
- a clear summary of the change
- why it belongs in this fork
- screenshots for UI changes
- commands run for validation
- any deploy, migration, or sync-with-upstream implications

## Review expectations

This is a personal fork, so review cadence is best-effort rather than community-SLA driven.

If you need a guaranteed path to merge for a generally useful change, upstream Karakeep is usually the better place to propose it.
