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

# <img height="50" src="./screenshots/logo.png" alt="Karakeep logo" />

Karakeep is a self-hostable bookmark-everything app for saving links, notes, images, PDFs, and web pages, then finding them again with fast search, lists, highlights, and optional AI tagging/summarization.

> This repository is **not the upstream Karakeep repo**. It is an opinionated personal fork of [karakeep-app/karakeep](https://github.com/karakeep-app/karakeep) focused on UX, QoL, and personal operator workflow changes while staying close to upstream.

![Homepage screenshot](./screenshots/homepage.png)

## What this repository is

This fork keeps the upstream Karakeep product intact in spirit, but documents and operates it as a real personal deployment:

- **Origin:** `absolutepraya/karakeep`
- **Upstream:** `karakeep-app/karakeep`
- **Focus:** UX polish, quality-of-life improvements, and personal deployment ergonomics
- **Local dev:** one-command workflow via `./start-dev.sh`
- **Deploy model:** pull-based Docker image delivery via GHCR + Watchtower

If you want the main project, releases, or community-first contribution flow, start with the upstream repo:
- Upstream repo: <https://github.com/karakeep-app/karakeep>
- Upstream docs: <https://docs.karakeep.app>

If you are here to work on **this fork**, the most important repo-specific guide is:
- [`docs/fork-setup.md`](docs/fork-setup.md)

## What Karakeep does

Karakeep can:

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

### Preferred local development

From the repository root:

```bash
pnpm install

ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/workers/.env
ln -sf ../../.env packages/db/.env

pnpm db:migrate
./start-dev.sh
```

That starts:
- the web app
- background workers
- Meilisearch in Docker
- headless Chrome in Docker

Then open:
- <http://localhost:3000>

### Manual split-terminal development

```bash
pnpm web
pnpm workers
```

Meilisearch and headless Chrome are optional for booting the app, but required for full search/crawling behavior.

### Full fork/operator setup

For the complete local-dev and deploy workflow, read:
- [`docs/fork-setup.md`](docs/fork-setup.md)

## Documentation map

### For this fork
- Fork/local dev/deploy guide: [`docs/fork-setup.md`](docs/fork-setup.md)
- Docs-site development guide: [`docs/README.md`](docs/README.md)
- Contribution guidance for this repo: [`CONTRIBUTING.md`](CONTRIBUTING.md)

### For upstream Karakeep product usage
- Main docs: <https://docs.karakeep.app>
- Installation: <https://docs.karakeep.app>
- Configuration: <https://docs.karakeep.app>
- Development docs: <https://docs.karakeep.app>
- API docs: <https://docs.karakeep.app/api>

## Demo

Upstream maintains the public demo at:
- <https://try.karakeep.app>

Demo credentials:

```text
email: demo@karakeep.app
password: demodemo
```

The demo is read-only.

## About the name

Karakeep is inspired by the Arabic word **كراكيب** (*karakeeb*), a colloquial term for miscellaneous clutter, odds and ends, or things that look messy but still feel worth keeping. It fits a personal library for links, notes, screenshots, and all the other things you are not ready to lose.

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

1. **Upstream Karakeep contributions**
   - Use <https://github.com/karakeep-app/karakeep>
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

Upstream Karakeep is developed by [Localhost Labs Ltd](https://localhostlabs.co.uk). This repository is a personal fork, not the canonical upstream source.
