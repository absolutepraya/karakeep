<div align="center">
  <a href="https://github.com/absolutepraya/marka/actions/workflows/ci.yml">
    <img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/absolutepraya/marka/ci.yml?branch=main&label=ci" />
  </a>
</div>

# Marka

<img height="83" src="./screenshots/marka-logo-readme.png" alt="Marka logo" />

Marka is a self-hostable library for saving links, notes, images, PDFs, and web pages, then finding them again with fast search, lists, highlights, and optional AI tagging and summarization.

![Homepage screenshot](./screenshots/homepage.png)

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

## Key features

- Bookmark links, store notes, images, and PDFs
- Organize bookmarks into lists
- Collaborate with others on shared lists
- Search across saved content
- Automatic AI tagging and summarization
- Save highlights from your reading
- Archive full pages to protect against link rot
- Auto-hoard from RSS feeds
- REST API, SDKs, CLI, and MCP server
- Browser extension and mobile apps
- Self-hosting first

## Quick start

### Guided self-hosted install

For a Linux `amd64` host that already has Docker Engine, Docker Compose v2, and OpenSSL, run:

```bash
curl -fsSLo /tmp/marka-setup.sh https://raw.githubusercontent.com/absolutepraya/marka/main/scripts/install.sh && bash /tmp/marka-setup.sh
```

The guided flow asks for the install/data directories, public URL, search mode, browser-rendering mode, AI setup, and whether an existing compatible data directory should be reused. It generates a Docker Compose stack using the paired `web-main` and `workers-main` images, writes secrets to restricted env files, validates the Compose config, and starts the deployment.

The default listener is `127.0.0.1:3000`, so an Internet-facing deployment should normally put a reverse proxy with TLS in front of it. The script does not install Docker, alter firewall rules, configure DNS, or provision certificates.

For a reproducible setup, replace `main` with an immutable release tag or commit SHA after reviewing that revision:

```bash
REF=<tag-or-commit-sha>; curl -fsSLo /tmp/marka-setup.sh "https://raw.githubusercontent.com/absolutepraya/marka/${REF}/scripts/install.sh" && bash /tmp/marka-setup.sh
```

After setup, the copied helper supports safe operations without deleting persistent data:

```bash
~/marka/install.sh status
~/marka/install.sh backup
~/marka/install.sh update
~/marka/install.sh uninstall
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

That starts the web app, background workers, Meilisearch, and headless Chrome. Then open <http://localhost:3000>.

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

Meilisearch and headless Chrome are optional for booting the app, but required for full search and crawling behavior.

### Pull production state into local dev

The helper below pulls the production `/data` state from the VPS into your local `DATA_DIR`:

```bash
pnpm prod:pull-state
pnpm prod:pull-state --dry-run
```

The command replaces local development state by default, first backing up the current `DATA_DIR`. It always pulls the full `/data` volume, including SQLite files and stored assets.

Required root `.env` keys:

- `DATA_DIR`
- `KARAKEEP_PROD_SSH_HOST`
- `KARAKEEP_PROD_COMPOSE_DIR`

Optional root `.env` keys:

- `KARAKEEP_PROD_SSH_USER`
- `KARAKEEP_PROD_COMPOSE_SERVICE`
- `KARAKEEP_PROD_EXPORT_IMAGE`

### Operator setup

For the complete local-development and deployment workflow, read [`docs/operator-setup.md`](docs/operator-setup.md).

## Documentation map

- Guided Docker self-hosting: [`docs/docs/02-installation/11-guided-docker-setup.md`](docs/docs/02-installation/11-guided-docker-setup.md)
- Operator and local-development guide: [`docs/operator-setup.md`](docs/operator-setup.md)
- Docs-site development guide: [`docs/README.md`](docs/README.md)
- Contribution guidance: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Tech stack

- **Web:** Next.js, React, TypeScript, Tailwind CSS
- **API:** Hono and tRPC
- **Database:** Drizzle ORM over SQLite (`better-sqlite3`)
- **Search:** Meilisearch
- **Crawling:** headless Chrome and background workers
- **Tooling:** pnpm, Turborepo, oxfmt, oxlint, Vitest

## Repo-specific development notes

- Deployments are pull-based through GHCR and Watchtower.
- The canonical production Compose file is `deploy/docker-compose.prod.yml`.
- `knip` and `react.doctor` provide additional quality checks.
- `react-grab` is loaded only in local development for component/source capture.

## Contributing

Open an issue or discussion first for large, behavioral, or opinionated changes. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the repository workflow.

## License

Marka remains licensed under [AGPL-3.0](./LICENSE).

## Attribution

Marka builds on the open-source [Karakeep](https://github.com/karakeep-app/karakeep) project.
