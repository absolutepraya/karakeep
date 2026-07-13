# Fork setup and deploy notes

This is the canonical operator/developer guide for **this fork** of Karakeep.

Use it for:
- local development in this repository
- CI and image-build behavior
- production deployment notes specific to this fork

## Repo identity

- **Origin:** `git@github.com:absolutepraya/karakeep.git`
- **Upstream:** `git@github.com:karakeep-app/karakeep.git`
- **Branch model:** `main` is the active integration/deploy branch for this fork

## Local development

### Runtime
- Node 24 (`.nvmrc`)
- `pnpm@11.2.1` via corepack

### First-time setup

```bash
corepack enable
pnpm install

cp .env.sample .env

ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/workers/.env
ln -sf ../../.env packages/db/.env

mkdir -p "$(grep '^DATA_DIR=' .env | cut -d= -f2)"
pnpm db:migrate
```

### Preferred start flow

```bash
pnpm dev:start
```

Variants:
- `pnpm dev:start` — foreground
- `pnpm dev:start -d` — detached (`.dev/` logs, shell returns immediately)
- `pnpm dev:stop` — stop detached services

What this starts:
- `web`
- `workers`
- Meilisearch in Docker
- headless Chrome in Docker

### Direct/manual start

```bash
pnpm web
pnpm workers
```

Notes:
- Meilisearch and headless Chrome are optional for booting the app, but required for full search/crawling behavior.
- If `next dev` crashes with a stale Turbopack / `instrumentation.ts` parse issue, clear `apps/web/.next` and restart.

### Verify the offline iPhone PWA

1. Open Karakeep in Safari on an iPhone and use **Add to Home Screen**.
2. Open the installed app, sign in, and wait until the library activity indicator shows **Online** with a successful sync time.
3. Turn off Wi-Fi and cellular data, force-close the installed app, then reopen it. Confirm the bookmark grid, local-only search, and available thumbnails render without a network request.
4. While offline, change a bookmark title, favorite state, or tags. Confirm the library activity indicator reports a pending write.
5. Restore connectivity. Confirm the pending write disappears after one successful sync and the server state matches the local edit.
6. Create a same-field edit from another signed-in device before reconnecting the offline phone. Confirm Karakeep presents a field-conflict choice instead of overwriting either value silently.
7. Log out on the phone, reopen the installed app offline, and confirm that no bookmarks, thumbnails, search results, pending writes, or conflict records remain.

PDFs, archived reader pages, uploads, crawler/AI jobs, sharing, list mutations, bulk destructive actions, and unsupported edits require a connection.

## Environment notes

The root `.env` is the source of truth, but several processes load `.env` from their own working directory. That is why the symlinks above are required.

The most important variables for local development are:
- `DATA_DIR`
- `NEXTAUTH_SECRET`
- `MEILI_ADDR` (if search should work)
- `OPENAI_API_KEY` (if AI tagging/summarization should work)

### Pull production state into local development

Use this helper when local development should mirror the persisted production state from the VPS:

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

## CI

Primary workflow:
- `.github/workflows/ci.yml`

It runs:
- lint
- format
- typecheck
- tests
- open-api-spec

Fork-specific notes:
- this fork does **not** use Turbo remote cache
- some CI jobs reclaim disk space before heavy steps because typecheck/tests can otherwise exhaust hosted-runner storage
- `knip` and `react-doctor` run as **non-blocking** report jobs

## Extra quality tooling

- `pnpm knip` — unused files / deps / exports (`knip.json`)
- `pnpm doctor` / `pnpm doctor:staged` — React health scan via react.doctor
- `react-grab` — dev-only component/source capture helper in the web app
- **Biome is intentionally not used** in this repo

## Build and deploy model

This fork deploys with a **pull-based Docker flow**.

### Build path
- `.github/workflows/docker.yml` builds the `aio` image on CI success on `main`
- the workflow pushes `ghcr.io/<owner>/karakeep:main`
- it also pushes a `:sha-<sha>` image tag

### Deploy path
- the VPS runs a Watchtower container
- Watchtower polls GHCR
- when `:main` changes, Watchtower recreates the `web` service

Important characteristics:
- no SSH deploy from CI
- GHCR package is public, so the VPS pulls anonymously
- the canonical production compose is `deploy/docker-compose.prod.yml`

## Production compose

Canonical compose file:
- `deploy/docker-compose.prod.yml`

Expected service shape:
- `web`
- `chrome`
- `meilisearch`
- `watchtower`

Key parameters:
- `KARAKEEP_PORT`
- `KARAKEEP_IMAGE`

Each service sets a `mem_limit` (web `2g`, chrome `1g`, meilisearch `512m`, watchtower `128m`) as a ceiling to keep the stack from ballooning and thrashing swap on the shared 8GB VPS. `web` gets the most headroom because the all-in-one image runs the app plus the background workers (crawl/AI/OCR/asset processing). These are caps, not reservations; raise a value if a service is legitimately OOM-killed.

The web container binds to localhost and is expected to sit behind nginx.

## VPS provisioning notes

Typical high-level flow:

```bash
~/setup-subdomain.sh <sub> <port>
mkdir ~/<dir> && cd ~/<dir>
# copy deploy/docker-compose.prod.yml here as docker-compose.yml
cat > .env <<'ENV'
NEXTAUTH_SECRET=...
MEILI_MASTER_KEY=...
NEXTAUTH_URL=https://<sub>.<your-domain>
KARAKEEP_PORT=<port>
DISABLE_SIGNUPS=false
ENV
docker compose up -d
```

Notes:
- create the relevant DNS record before expecting nginx/HTTPS to work
- this fork’s current operator notes assume the service is fronted by nginx
- depending on SSL/proxy mode, a Cloudflare orange-cloud proxy can cause redirect loops; DNS-only/grey-cloud has been the safer path for this setup

## Related docs

- Public repo overview: `README.md`
- Contribution rules: `CONTRIBUTING.md`
- Assistant-facing summaries: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
- Docs-site workflow: `docs/README.md`
