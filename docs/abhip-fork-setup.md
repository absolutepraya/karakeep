# Abhip fork setup

Personal Karakeep fork for UI/QoL work. Public repo. Deploys are **pull-based**
(GitHub Actions builds the image; the VPS pulls it) because the VPS firewalls SSH
to Tailscale only, so CI can't push-deploy over SSH.

## Repo layout

- `origin`: `git@github.com:absolutepraya/karakeep.git`
- `upstream`: `git@github.com:karakeep-app/karakeep.git`

## Local development

Runtime: Node 24 (`.nvmrc`), `pnpm@11.2.1` (via corepack; matches `packageManager`).

```bash
# node 24 via mise (this machine's mise + gpg/keyboxd needs the verify bypass once):
MISE_NODE_GPG_VERIFY=false mise install node@24.16.0
corepack enable                 # provisions pnpm 11.2.1
pnpm install

# each process loads .env from its own CWD — symlink the root .env into each:
ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/workers/.env
ln -sf ../../.env packages/db/.env

mkdir -p "$(grep '^DATA_DIR=' .env | cut -d= -f2)"
pnpm db:migrate                 # init the sqlite DB (not auto-run on boot)

pnpm web        # http://localhost:3000
pnpm workers    # separate terminal
```

Meilisearch (search) and headless Chrome (crawling) are optional — the web app
boots without them. `./start-dev.sh` brings both up in Docker; or use the full
Docker dev stack: `docker compose -f docker/docker-compose.dev.yml up`.

## CI (`.github/workflows/ci.yml`)

`lint`, `format`, `typecheck`, `tests`, `open-api-spec`. The fork has **no Turbo
remote cache**, so `typecheck` and `tests` rebuild everything from scratch and
exhaust the hosted runner's disk — both jobs include a "Free up disk space" step
that reclaims ~20GB of unused preinstalled toolchains. (Divergence from upstream.)

## Build + deploy (pull-based)

- **`.github/workflows/docker.yml`** ("Build and Push image"): on CI success on
  `main` (or manual `workflow_dispatch`), builds the `linux/amd64` `aio` image and
  pushes `ghcr.io/<owner>/karakeep:main` (+ a `:sha-<sha>` tag). No SSH/deploy step.
- The **GHCR package is public**, so the VPS pulls anonymously (no token).
- On the VPS, a **watchtower** container (`ghcr.io/nicholas-fedor/watchtower` — the
  maintained fork; the original `containrrr/watchtower` is abandoned and too old for
  modern Docker engines) polls GHCR every 60s and recreates `web` when `:main`
  changes. Only the labeled `web` service is auto-updated (`WATCHTOWER_LABEL_ENABLE`).

Flow: merge to `main` → CI → "Build and Push image" → new `:main` → watchtower
redeploys `web` within ~1 min. (The image build is the slow part, ~12–20 min.)

## Deploy compose (`deploy/docker-compose.prod.yml`)

Canonical compose for any instance: `web` + `chrome` + `meilisearch` + `watchtower`,
parametrized by `KARAKEEP_PORT` (host port nginx proxies to) and `KARAKEEP_IMAGE`.
`web` binds `127.0.0.1:${KARAKEEP_PORT}:3000` (localhost only; nginx fronts it).

## Provisioning a VPS instance (staging is live; prod later)

The VPS already runs a staging instance at `keep-dev.<your-domain>` (compose project
`karakeep-dev` under `~/karakeep-dev`, host port 3100, isolated volumes — separate
from the live `~/karakeep` instance). To stand up another:

```bash
~/setup-subdomain.sh <sub> <port>          # nginx vhost + Let's Encrypt cert
mkdir ~/<dir> && cd ~/<dir>
# copy deploy/docker-compose.prod.yml here as docker-compose.yml, then:
cat > .env <<'ENV'
NEXTAUTH_SECRET=...        # openssl rand -base64 36
MEILI_MASTER_KEY=...       # openssl rand -base64 36
NEXTAUTH_URL=https://<sub>.<your-domain>
KARAKEEP_PORT=<port>
DISABLE_SIGNUPS=false
ENV
docker compose up -d
```

Add a Cloudflare A record for `<sub>` → server IP, **DNS-only (grey)** — matching
the other service subdomains. (The orange proxy currently causes a redirect loop
given the zone SSL mode + nginx's HTTPS redirect; keep services grey.)
