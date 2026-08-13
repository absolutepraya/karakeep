# Guided Docker Setup for This Fork

:::info Fork-specific setup
This page documents the guided setup shipped by `absolutepraya/karakeep`. It is not the upstream Karakeep setup flow.
:::

The guided script creates a Docker Compose deployment without installing system packages, changing firewall rules, configuring DNS, or provisioning TLS. Docker Engine, Docker Compose v2, and OpenSSL must already be installed on a Linux `amd64` host.

## One-line start

Run the latest guided script from this fork:

```bash
curl -fsSLo /tmp/karakeep-setup.sh https://raw.githubusercontent.com/absolutepraya/karakeep/main/scripts/install.sh && bash /tmp/karakeep-setup.sh
```

The script is downloaded to a file before execution rather than piped directly into a shell. During setup it copies itself into the selected configuration directory, which defaults to `~/karakeep`.

For a reproducible setup, pin the download to an immutable release tag or commit SHA after reviewing that revision:

```bash
REF=<tag-or-commit-sha>; curl -fsSLo /tmp/karakeep-setup.sh "https://raw.githubusercontent.com/absolutepraya/karakeep/${REF}/scripts/install.sh" && bash /tmp/karakeep-setup.sh
```

## What the guided flow asks

The interactive flow asks for:

- the configuration directory
- the persistent Karakeep data directory
- whether the data directory is fresh or an existing compatible Karakeep data directory
- the public application URL, host port, and bind address
- managed, external, or disabled Meilisearch
- managed private Chrome, external token-protected Browserless, or disabled browser rendering
- disabled, OpenAI-compatible, or deferred AI tagging/summarization
- the signup policy for an existing deployment

Fresh deployments always start with signups enabled so the first administrator account can be created. After that account exists, set `DISABLE_SIGNUPS="true"` in `app.env` and run the generated helper with `start`.

## Generated deployment

The script uses the stable Compose project name `karakeep` and the paired fork images:

- `ghcr.io/absolutepraya/karakeep:web-main`
- `ghcr.io/absolutepraya/karakeep:workers-main`

The generated files are stored in the selected configuration directory:

- `docker-compose.yml`
- `app.env`
- `workers.env`
- `.data-dir`
- `install.sh`

`app.env`, `workers.env`, and `.data-dir` are written with restrictive permissions. Secrets are never printed and are not accepted as command-line arguments.

The default bind address is `127.0.0.1`. For an Internet-facing deployment, keep the application bound locally and place a reverse proxy with TLS in front of it. The script does not configure DNS, certificates, reverse proxies, or firewall rules.

## Search choices

`managed` starts the repository's currently supported Meilisearch image inside the Compose project. The service is not published to the host network.

`external` connects to an existing Meilisearch URL. In non-interactive mode, provide its key through `KARAKEEP_MEILI_MASTER_KEY`.

`disabled` omits Meilisearch entirely. Full-text search will not be available.

## Browser-rendering choices

`managed` starts a private Chrome container and connects the workers through the internal Compose network. The Chrome debugging port is not published to the host.

`external` connects workers on demand to an existing Browserless endpoint. In non-interactive mode, provide the token through `KARAKEEP_BROWSERLESS_TOKEN`. Keep the endpoint private or protect it with TLS and network controls.

`disabled` turns off rendered screenshots and JavaScript browser crawling. Basic non-browser crawling can still work.

## AI choices

`openai` enables automatic tagging and summarization through OpenAI or an OpenAI-compatible API. In non-interactive mode, provide `KARAKEEP_OPENAI_API_KEY`. Optional overrides are available through `KARAKEEP_OPENAI_BASE_URL`, `KARAKEEP_INFERENCE_TEXT_MODEL`, and `KARAKEEP_INFERENCE_IMAGE_MODEL`.

`disabled` explicitly disables automatic tagging and summarization.

`deferred` also leaves AI disabled, but records that the operator intends to configure the provider later in `workers.env`.

## Non-interactive example

Explicit deployment choices are required in non-interactive mode. Secrets are supplied through environment variables, not flags:

```bash
KARAKEEP_OPENAI_API_KEY='...' bash /tmp/karakeep-setup.sh \
  --non-interactive \
  --public-url https://keep.example.com \
  --data-mode fresh \
  --search managed \
  --renderer managed \
  --ai openai
```

Use `--dry-run` to validate the plan without writing files or changing containers. Use `--no-start` to generate and validate the configuration without pulling or starting images.

## Reruns and reconfiguration

A normal rerun refuses to overwrite generated configuration. To deliberately reconfigure an existing guided deployment, use `--reconfigure`. The previous generated files are copied into a timestamped `config-backups/` directory before replacement.

The persistent data directory is never overwritten or deleted by the script. A non-empty directory cannot be used as `fresh` data.

## Operations

The script copy in the configuration directory also acts as the management helper:

```bash
~/karakeep/install.sh status
~/karakeep/install.sh backup
~/karakeep/install.sh update
~/karakeep/install.sh stop
~/karakeep/install.sh start
~/karakeep/install.sh uninstall
```

`backup` briefly stops the web and worker services, archives the authoritative SQLite/assets data directory, then restores them if they were running. Meilisearch is not included because it is a derived search index.

`update` pulls the current `web-main` and `workers-main` images and recreates changed services. For rollback, pin both images to matching immutable `web-sha-<sha>` and `workers-sha-<sha>` tags from the same known-good commit.

`uninstall` removes the Compose containers and network only. It intentionally keeps both the configuration directory and persistent data directory.

## Validation

The repository includes shell-level tests covering dry-run behavior, generated managed/external/disabled configurations, secret redaction, rerun protection, config backups, signup lockout prevention, backups, and non-destructive uninstall:

```bash
bash scripts/install.test.sh
```
