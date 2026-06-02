# Abhip fork setup

This repo is the personal Karakeep fork for UI/QoL work.

## Repo layout

- Local path: `~/Documents/Projects/Karakeep/karakeep`
- `origin`: `git@github.com:absolutepraya/karakeep.git`
- `upstream`: `git@github.com:karakeep-app/karakeep.git`

## Local development

### Recommended: Docker dev stack

Karakeep already ships a good dev compose stack, so use that first.

1. Create a local root `.env`.
2. Start the stack:

```bash
cd ~/Documents/Projects/Karakeep/karakeep
docker compose -f docker/docker-compose.dev.yml up
```

Services:

- Web: `http://localhost:3000`
- Chrome debugger: `http://localhost:9222`
- Meilisearch runs inside compose

Stop everything:

```bash
docker compose -f docker/docker-compose.dev.yml down
```

If you want a clean rebuild:

```bash
docker compose -f docker/docker-compose.dev.yml down -v
```

### Optional: native dev

If you want to run outside Docker, upstream expects:

- Node `24`
- `corepack` enabled
- `pnpm@11.2.1`

Then run:

```bash
pnpm install
./start-dev.sh
```

## Local `.env`

A local `.env` should exist in the repo root and stay uncommitted.

Recommended values for local dev:

```env
DATA_DIR=/absolute/path/to/karakeep/.data/local
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=http://localhost:3000
MEILI_ADDR=http://127.0.0.1:7700
BROWSER_WEB_URL=http://127.0.0.1:9222
```

Notes:

- Keep local and VPS secrets separate.
- For local work, you usually do **not** need to reuse production credentials.
- If you want realistic data locally, export/import a DB copy from the VPS instead of pointing local dev at prod data.

## CI/CD shape

The fork now has a GitHub Actions workflow at `.github/workflows/docker.yml` that:

1. Waits for the `CI` workflow to pass on `main`
2. Builds the `aio` Docker image
3. Pushes it to `ghcr.io/absolutepraya/karakeep:main`
4. SSHes into the VPS
5. Uploads `deploy/docker-compose.prod.yml`
6. Runs `docker compose pull && docker compose up -d`

## GitHub secrets to add

Add these secrets in `absolutepraya/karakeep`:

- `VPS_HOST` — VPS hostname or IP
- `VPS_USER` — SSH user
- `VPS_SSH_KEY` — private key for the deploy user
- `DEPLOY_PATH` — target directory on the VPS, e.g. `/opt/karakeep-fork`
- `GHCR_READ_TOKEN` — GitHub token with `read:packages`

You can add them with `gh secret set` or via the GitHub UI.

## One-time VPS bootstrap

On the VPS, create a deploy directory and put the production `.env` there.

Example:

```bash
mkdir -p /opt/karakeep-fork
nano /opt/karakeep-fork/.env
```

Then the workflow will keep uploading `docker-compose.yml` into that folder.

If you already have a working Karakeep instance, the easiest path is:

1. Copy its current `.env`
2. Review `NEXTAUTH_URL`, domain, OAuth callbacks, and any API keys
3. Decide whether this fork replaces prod or first lands on a staging subdomain

## Production compose file

The deploy workflow uploads `deploy/docker-compose.prod.yml` to the VPS as `docker-compose.yml`.

It uses:

```env
KARAKEEP_IMAGE=ghcr.io/absolutepraya/karakeep:main
```

at deploy time, so every merge to `main` rolls out the latest built image.

## Safe rollout suggestion

Do this in two stages:

1. Point the workflow at a staging folder/subdomain first
2. Test one or two real changes there
3. Only then switch the live deployment (your production Karakeep domain) over

That will save you from accidentally breaking your current working instance while the fork is still young.
