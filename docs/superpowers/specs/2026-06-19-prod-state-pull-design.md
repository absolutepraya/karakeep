# Prod State Pull Script Design

## Goal

Add a local operator script that pulls the production Karakeep persisted state from the VPS into local development without committing secrets or hardcoding machine-specific values.

The default behavior should mirror the full production `/data` directory because the SQLite database can reference stored assets. A `--db-only` mode will exist for faster, narrower syncs when assets are not needed.

## Configuration

The script reads from the root `.env`, which is already the local source of truth for development.

Required variables:

- `DATA_DIR`: local development data directory to replace.
- `KARAKEEP_PROD_SSH_HOST`: SSH host alias or hostname for the VPS.
- `KARAKEEP_PROD_COMPOSE_DIR`: directory on the VPS that contains the production `docker-compose.yml`.

Optional variables:

- `KARAKEEP_PROD_SSH_USER`: SSH username, omitted when the SSH host alias already includes it.
- `KARAKEEP_PROD_COMPOSE_SERVICE`: production app service name, default `web`.
- `KARAKEEP_PROD_DATA_VOLUME`: compose data volume name, default `data`.

No secret values should be printed.

## Behavior

The script will:

1. Load and validate `.env`.
2. Resolve the local `DATA_DIR`.
3. Print a dry-run plan by default.
4. Require `--yes` before replacing local data.
5. Create a timestamped backup of the current local `DATA_DIR`.
6. Use SSH to run Docker Compose on the VPS.
7. Pause the production web service while exporting state, then unpause it afterward.
8. Export the production Docker data volume through a tar stream.
9. Restore the stream into local `DATA_DIR`.
10. Run `pnpm db:migrate` unless `--skip-migrate` is passed.

`--db-only` will export only SQLite files (`db.db`, `db.db-wal`, and `db.db-shm` when present) from the production data volume.

## Safety

- The script should fail before changes when required config is missing.
- Local data is backed up before replacement.
- `--dry-run` is the default.
- `--yes` is required for destructive local replacement.
- Temporary files and directories are removed on exit.
- Production service unpause runs in cleanup logic even if export fails.

## Docs

Update `README.md` and `AGENTS.md` with:

- The new command.
- The required `.env` variables.
- A warning that this replaces local development data.
- The default full-state behavior and optional DB-only mode.

## Verification

Verify with:

- Shell syntax check.
- A dry run with current `.env` proving missing prod variables are reported clearly.
- Formatting/lint checks for changed docs or package metadata where applicable.
