#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: pnpm prod:pull-state [--dry-run] [--skip-migrate]

Pull production Karakeep persisted state, including all assets, into local development.

Options:
  --dry-run       Print the replacement plan without changing local state.
  --skip-migrate  Do not run pnpm db:migrate after restore.
USAGE
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$repo_root/.env"
mode="full"
dry_run="false"
skip_migrate="false"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

quote_remote() {
  printf '%q' "$1"
}

while (($# > 0)); do
  case "$1" in
    --dry-run)
      dry_run="true"
      ;;
    --skip-migrate)
      skip_migrate="true"
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
  shift
done

[[ -f "$env_file" ]] || die "missing .env at $env_file"

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

missing=()
for name in DATA_DIR KARAKEEP_PROD_SSH_HOST KARAKEEP_PROD_COMPOSE_DIR; do
  [[ -n "${!name:-}" ]] || missing+=("$name")
done

if ((${#missing[@]} > 0)); then
  printf 'Missing required .env variables:\n' >&2
  printf '  - %s\n' "${missing[@]}" >&2
  printf '\nAdd them to .env. See .env.sample for non-secret placeholders.\n' >&2
  exit 1
fi

prod_service="${KARAKEEP_PROD_COMPOSE_SERVICE:-web}"
export_image="${KARAKEEP_PROD_EXPORT_IMAGE:-alpine:3.20}"
timestamp="$(date +%Y%m%d-%H%M%S)"
# DATA_DIR is loaded from the root .env above.
# shellcheck disable=SC2153
case "$DATA_DIR" in
  /*) data_dir="$DATA_DIR" ;;
  *) data_dir="$repo_root/$DATA_DIR" ;;
esac
backup_dir="${data_dir}.backups/prod-pull-${timestamp}"

if [[ -n "${KARAKEEP_PROD_SSH_USER:-}" ]]; then
  ssh_target="${KARAKEEP_PROD_SSH_USER}@${KARAKEEP_PROD_SSH_HOST}"
else
  ssh_target="$KARAKEEP_PROD_SSH_HOST"
fi

cat <<PLAN
Prod state pull plan
  mode: $mode
  ssh host: $KARAKEEP_PROD_SSH_HOST
  ssh user: ${KARAKEEP_PROD_SSH_USER:+set}
  prod compose dir: $KARAKEEP_PROD_COMPOSE_DIR
  prod service: $prod_service
  local DATA_DIR: $data_dir
  local backup: $backup_dir
  run migrations: $([[ "$skip_migrate" == "true" ]] && printf 'no' || printf 'yes')
PLAN

if [[ "$dry_run" == "true" ]]; then
  cat <<'DRYRUN'

Dry run only. Re-run without --dry-run to replace local development state.
DRYRUN
  exit 0
fi

tmp_dir="$(mktemp -d)"
archive_path="$tmp_dir/prod-data.tar"
restore_dir="$tmp_dir/restore"
mkdir -p "$restore_dir"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

# Keep this single-quoted so it expands on the VPS, not locally.
# shellcheck disable=SC2016
remote_script='
set -euo pipefail

cd "$KARAKEEP_PROD_COMPOSE_DIR"

service="${KARAKEEP_PROD_COMPOSE_SERVICE:-web}"
export_image="${KARAKEEP_PROD_EXPORT_IMAGE:-alpine:3.20}"
mode="${KARAKEEP_PULL_MODE:-full}"
container_id="$(docker compose ps -q "$service")"

if [ -z "$container_id" ]; then
  echo "error: service is not running: $service" >&2
  exit 1
fi

paused="false"
cleanup_remote() {
  if [ "$paused" = "true" ]; then
    docker compose unpause "$service" >/dev/null 2>&1 || true
  fi
}
trap cleanup_remote EXIT

docker compose pause "$service" >/dev/null
paused="true"

docker run --rm --volumes-from "$container_id":ro "$export_image" sh -c '"'"'
  set -eu
  cd /data
  tar -cf - .
'"'"'
'

printf 'Downloading prod %s state...\n' "$mode"
# The remote environment assignment is intentionally expanded locally and quoted
# before being passed to SSH.
# shellcheck disable=SC2029
ssh \
  "$ssh_target" \
  "KARAKEEP_PROD_COMPOSE_DIR=$(quote_remote "$KARAKEEP_PROD_COMPOSE_DIR") KARAKEEP_PROD_COMPOSE_SERVICE=$(quote_remote "$prod_service") KARAKEEP_PROD_EXPORT_IMAGE=$(quote_remote "$export_image") KARAKEEP_PULL_MODE=$(quote_remote "$mode") bash -s" \
  >"$archive_path" <<<"$remote_script"

tar -tf "$archive_path" >/dev/null
tar -xf "$archive_path" -C "$restore_dir"

mkdir -p "$(dirname "$data_dir")"
if [[ -e "$data_dir" ]]; then
  mkdir -p "$(dirname "$backup_dir")"
  mv "$data_dir" "$backup_dir"
fi

mv "$restore_dir" "$data_dir"

printf 'Restored prod %s state to %s\n' "$mode" "$data_dir"
if [[ -d "$backup_dir" ]]; then
  printf 'Previous local state backed up at %s\n' "$backup_dir"
fi

if [[ "$skip_migrate" != "true" ]]; then
  pnpm db:migrate
fi
