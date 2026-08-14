<div align="center">
  <a href="https://github.com/absolutepraya/karakeep/actions/workflows/ci.yml">
    <img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/absolutepraya/karakeep/ci.yml?branch=main&label=ci" />
  </a>
  <a href="https://github.com/karakeep-app/karakeep/releases">
    <img alt="Upstream release" src="https://img.shields.io/github/v/release/karakeep-app/karakeep?label=upstream%20release" />
  </a>
  <a href="https://discord.gg/NrgeYywsFh">
    <img alt="Discord" src="https://img.shields.io/discord/1223681308962721802?label=upstream%20discord" />
  </a>
  <a href="https://hosted.weblate.org/engage/hoarder/">
    <img src="https://hosted.weblate.org/widget/hoarder/hoarder/svg-badge.svg" alt="Translation status" />
  </a>
</div>

# Marka

<img height="83" src="./screenshots/marka-logo.png" alt="Marka logo" />

Marka is a self-hostable library for saving links, notes, images, PDFs, and web pages, then finding them again with fast search, lists, highlights, and optional AI tagging and summarization.

> [`absolutepraya/karakeep`](https://github.com/absolutepraya/karakeep) is the Marka fork. The upstream Karakeep project is <https://github.com/karakeep-app/karakeep>.

![Homepage screenshot](./screenshots/homepage.png)

## What this repository is

This fork keeps the upstream product intact in spirit, while presenting and operating it as Marka:

- **Marka fork:** `absolutepraya/karakeep`
- **Upstream project:** <https://github.com/karakeep-app/karakeep>
- **Focus:** UX polish, quality-of-life improvements, and personal deployment ergonomics
- **Local dev:** one-command workflow via `pnpm dev:start`
- **Deploy model:** pull-based Docker image delivery via GHCR + Watchtower

If you want the main project, releases, or community-first contribution flow, start with the upstream repo:
- Upstream repo: <https://github.com/karakeep-app/karakeep>
- Upstream docs: <https://docs.karakeep.app>

If you are here to work on **this fork**, the most important repo-specific guide is:
- [`docs/fork-setup.md`](docs/fork-setup.md)

## What Marka does

Marka can:

- save **links, notes, images, and PDFs**
- fetch link titles, descriptions, and preview images automatically
- organize bookmarks into **lists** and **tags**
- support **collaborative lists**
- provide **full-text search** across saved content
- run **AI tagging and summarization** (including local-model setups)
- archive pages to reduce link rot
- save and revisit **highlights**
- sync with browser workflows through extensions, RSS, CLI, API, and MCP tooling

### Key features

- 🔗 Bookmark links, store notes, images, and PDFs
- 📋 Organize bookmarks into lists
- 👥 Collaborate with others on shared lists
- 🔎 Search across saved content
- ✨ Automatic AI tagging and summarization
- 🖍️ Save highlights from your reading
- 🗄️ Archive full pages to protect against link rot
- 📰 Auto-hoard from RSS feeds
- 🔌 REST API, SDKs, CLI, and MCP server
- 📱 Browser extension + mobile apps
- 💾 Self-hosting first

## Quick start for this fork

### Guided self-hosted install

For a Linux `amd64` host that already has Docker Engine, Docker Compose v2, and OpenSSL, run:

```bash
curl -fsSLo /tmp/karakeep-setup.sh https://raw.githubusercontent.com/absolutepraya/karakeep/main/scripts/install.sh && bash /tmp/karakeep-setup.sh
```

The command downloads the script to a file before executing it. The guided flow asks for the install/data directories, public URL, search mode, browser-rendering mode, AI setup, and whether an existing compatible data directory should be reused. It generates a Docker Compose stack using the fork's paired `web-main` and `workers-main` images, writes secrets to restricted env files, validates the Compose config, and then starts the deployment.

The default listener is `127.0.0.1:3000`, so an Internet-facing deployment should normally put a reverse proxy with TLS in front of it. The script deliberately does not install Docker, alter firewall rules, configure DNS, or provision certificates.

For a reproducible setup, replace `main` with an immutable release tag or commit SHA after reviewing that revision:

```bash
REF=<tag-or-commit-sha>; curl -fsSLo /tmp/karakeep-setup.sh "https://raw.githubusercontent.com/absolutepraya/karakeep/${REF}/scripts/install.sh" && bash /tmp/karakeep-setup.sh
```

After setup, the copied helper supports safe operations without deleting persistent data:

```bash
~/karakeep/install.sh status
~/karakeep/install.sh backup
~/karakeep/install.sh update
~/karakeep/install.sh uninstall
```

For all installer choices, non-interactive usage, rollback guidance, and safety behavior, see [`docs/docs/02-installation/11-guided-docker-setup.md`](docs/docs/02-installation/11-guided-docker-setup.md).

### Preferred local development

From the repository root:

```bash
pnpm install

ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/workers/.env
ln -sf ../../.env packages/db/.env

pnpm db:migrate
pnpm dev:start
```

That starts:
- the web app
- background workers
- Meilisearch in Docker
- headless Chrome in Docker

Then open:
- <http://localhost:3000>

Useful variants:

```bash
pnpm dev:start -d
pnpm dev:stop
```

### Manual split-terminal development

```bash
pnpm web
pnpm workers
```

Meilisearch and headless Chrome are optional for booting the app, but required for full search/crawling behavior.

### Pull production state into local dev

The helper below pulls the production `/data` state from the VPS into your local `DATA_DIR`.

```bash
pnpm prod:pull-state
pnpm prod:pull-state --dry-run
```

The command replaces local development state by default, first backing up the current `DATA_DIR`. It always pulls the full `/data` volume, including SQLite files and stored assets. Use `--dry-run` to inspect the plan without replacing local state.

Required root `.env` keys:
- `DATA_DIR`
- `KARAKEEP_PROD_SSH_HOST`
- `KARAKEEP_PROD_COMPOSE_DIR`

Optional root `.env` keys:
- `KARAKEEP_PROD_SSH_USER`
- `KARAKEEP_PROD_COMPOSE_SERVICE`
- `KARAKEEP_PROD_EXPORT_IMAGE`

### Full fork/operator setup

For the complete local-dev and deploy workflow, read:
- [`docs/fork-setup.md`](docs/fork-setup.md)

## Documentation map

### For this fork
- Guided Docker self-hosting: [`docs/docs/02-installation/11-guided-docker-setup.md`](docs/docs/02-installation/11-guided-docker-setup.md)
- Fork/local dev/deploy guide: [`docs/fork-setup.md`](docs/fork-setup.md)
- Docs-site development guide: [`docs/README.md`](docs/README.md)
- Contribution guidance for this repo: [`CONTRIBUTING.md`](CONTRIBUTING.md)

### For upstream product usage
- Upstream main docs: <https://docs.karakeep.app>
- Upstream installation docs: <https://docs.karakeep.app>
- Upstream configuration docs: <https://docs.karakeep.app>
- Upstream development docs: <https://docs.karakeep.app>
- Upstream API docs: <https://docs.karakeep.app/api>

## Demo

The upstream project maintains the public demo:
- Upstream demo: <https://try.karakeep.app>

Demo credentials:

```text
email: demo@karakeep.app (upstream demo)
password: demodemo
```

The demo is read-only.

## Upstream name

The upstream Karakeep name is inspired by the Arabic word **كراكيب** (*karakeeb*), a colloquial term for miscellaneous clutter, odds and ends, or things that look messy but still feel worth keeping.

## Tech stack

- **Web:** Next.js, React, TypeScript, Tailwind CSS
- **API:** Hono + tRPC
- **Database:** Drizzle ORM over SQLite (`better-sqlite3`)
- **Search:** Meilisearch
- **Crawling:** headless Chrome / browser worker flow
- **Tooling:** pnpm, Turborepo, oxfmt, oxlint, Vitest

## Repo-specific development notes

This fork intentionally differs from upstream in a few practical ways:

- deploys are **pull-based** rather than SSH push-based
- the canonical production compose lives at `deploy/docker-compose.prod.yml`
- `knip` and `react.doctor` are present as additional quality tooling
- `react-grab` is loaded only in local development for component/source capture

## Contributing

There are two contribution paths:

1. **Upstream contributions**
   - Use the upstream repository: <https://github.com/karakeep-app/karakeep>
   - Follow the upstream community process

2. **Fork-specific contributions for this repo**
   - Use this repository
   - Read [`CONTRIBUTING.md`](CONTRIBUTING.md)
   - Prefer changes that are explicitly valuable for this fork’s UX, operator flow, or maintenance model

## Community and support

- Upstream Discord: <https://discord.gg/NrgeYywsFh>
- Upstream project site: <https://karakeep.app>
- Upstream cloud: <https://cloud.karakeep.app>

## License

This fork remains licensed under [AGPL-3.0](./LICENSE).

The upstream Karakeep project is developed by [Localhost Labs Ltd](https://localhostlabs.co.uk). Marka is a personal fork, not the canonical upstream source.
