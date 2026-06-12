# Troubleshooting

This page covers the problems that come up most often when self-hosting or developing Karakeep from this repository.

## `SqliteError: no such table: user`

This almost always means the database was not initialized where the app expects it to be.

Common causes:
1. `DATA_DIR` points at the wrong place.
2. The backing directory was wiped or changed.
3. Migrations were never run.

Checks:
- confirm `DATA_DIR` in your environment
- confirm the app and workers are reading the same `.env`
- run:

```bash
pnpm db:migrate
```

## The app boots, but auth/search/workers act like env vars are missing

In this repo, multiple processes load `.env` from their own working directory.

If you created only the root `.env` file and did not symlink it into the app/package directories, behavior can look partially broken.

Expected symlinks:

```bash
ln -sf ../../.env apps/web/.env
ln -sf ../../.env apps/workers/.env
ln -sf ../../.env packages/db/.env
```

## `next dev` crashes with a stale Turbopack / `instrumentation.ts` parse error

This fork occasionally hits a stale `.next` cache issue after type generation or interrupted dev runs.

Clear the web app cache and restart:

```bash
rm -rf apps/web/.next
pnpm web
```

## `Chrome Failed to Read DnsConfig`

If you see this in the Chrome container logs, it is usually benign and unrelated to the actual issue you are debugging.

## AI tagging not working with OpenAI

Common causes:
1. `OPENAI_API_KEY` is missing or misspelled.
2. You changed the env file but did not restart the relevant services.
3. The OpenAI account does not have usable credits.

Checks:
- inspect the workers logs
- verify the env var name exactly
- restart the app/workers after updating the env file

## AI tagging not working with Ollama

Common causes:
1. `OLLAMA_BASE_URL` is missing or misspelled.
2. Services were not restarted after updating the env file.
3. `INFERENCE_TEXT_MODEL` still points at a model name that only makes sense for OpenAI.
4. The Karakeep containers cannot actually reach Ollama.

If Ollama is unreachable, typical reasons are:
- wrong Docker network
- using `localhost` instead of the correct host/container address

Remember: inside a container, `localhost` points to the container itself, not your host machine.

## Crawling not working

Common causes:
1. Workers are not running.
2. The configured Chrome service is unreachable.
3. `BROWSER_WEB_URL` no longer matches the actual Chrome container/service name.

Checks:
- confirm `pnpm workers` is running, or use `./start-dev.sh`
- confirm the Chrome service is up
- inspect workers logs for crawl failures

## Search not working

Common causes:
1. Meilisearch is not running.
2. `MEILI_ADDR` is missing or incorrect.
3. The app was started before the search service was reachable.

Checks:
- confirm Meilisearch is reachable
- verify `MEILI_ADDR`
- reindex if needed from the admin panel after the service is healthy

## Meilisearch version / index migration problems

If you upgrade Meilisearch and see an incompatible database version error, the cleanest fix is usually to rebuild the Meilisearch data and reindex.

Typical recovery flow:
1. Stop Meilisearch.
2. Inside the mounted Meilisearch volume, remove or rename `data.ms`.
3. Start Meilisearch again.
4. Reindex bookmarks from the admin panel.

Use this carefully: deleting `data.ms` wipes the search index, so only do it if you are prepared to reindex.

## Cloudflare / reverse-proxy redirect loops on personal deployments

For this fork’s current VPS workflow, a Cloudflare orange-cloud proxy can cause redirect-loop behavior depending on SSL mode and nginx redirects.

If you hit that while following this repo’s operator workflow, check the notes in:
- `docs/fork-setup.md`

## Still stuck?

If you are debugging the product generically, upstream docs and community channels are still useful:
- [docs.karakeep.app](https://docs.karakeep.app)
- [Discord](https://discord.gg/NrgeYywsFh)

If you are debugging this fork’s local/dev/deploy workflow specifically, prefer the repo docs first:
- `README.md`
- `docs/fork-setup.md`
