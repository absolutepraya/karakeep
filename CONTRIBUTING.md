# Contributing

Thanks for taking the time to improve Marka.

This repository is the **Marka fork** of the upstream project, so contribution flow here is a little different from the main project.

## Which repo should you contribute to?

### Contribute upstream if...
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
- Node 24.18.1 (`.nvmrc`; temporarily pinned to avoid the Node 24.19 native-addon cleanup regression)
- `pnpm@11.2.1` via corepack
- root `.env` symlinked into `apps/web`, `apps/workers`, and `packages/db`

Quick start:

```bash
nvm install
nvm use
corepack enable
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
- GitHub Actions temporarily runs the combined test job on Node 22.21.1 because Vitest plus `better-sqlite3` can abort during worker teardown on Node 24. Local development and production remain on Node 24.18.1. Remove the CI override once <https://github.com/nodejs/node/pull/65042> ships in Node 24.
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
If you touch fork, development, or deployment facts, follow the authoritative documentation map:
- `README.md` provides public fork framing.
- `CONTRIBUTING.md` provides contribution rules.
- `docs/fork-setup.md` provides fork operation.
- `docs/README.md` provides docs-site development.
- `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` provide concise assistant operations context.
- Relevant docs-site pages under `docs/docs/**` must stay aligned when their content changes.

## PR guidance

A good PR for this repo should include:
- a clear summary of the change
- why it belongs in this fork
- screenshots for UI changes
- commands run for validation
- any deploy, migration, or sync-with-upstream implications

## Review expectations

Pull requests targeting `main` may receive an automated CodeRabbit review in addition to the repository's GitHub Actions checks.

During the initial rollout, CodeRabbit is advisory:
- GitHub Actions remains the source of truth for deterministic lint, format, typecheck, test, generated-artifact, Knip, and React Doctor validation.
- CodeRabbit adds contextual review, summaries, repository-specific guidance, and check context; it does not replace CI.
- CodeRabbit does not automatically request changes or act as a required merge gate during this calibration period.
- Contributors can reply to CodeRabbit comments or mention `@coderabbitai` in a PR discussion for follow-up context. A review can be requested explicitly with `@coderabbitai review` when needed.

This is a personal fork, so human review cadence is best-effort rather than community-SLA driven.

If you need a guaranteed path to merge for a generally useful change, the upstream Karakeep project is usually the better place to propose it.
