#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local file="$1" expected="$2"
  grep -Fq -- "$expected" "$file" || fail "Expected '$expected' in $file"
}

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

fake_bin="$test_root/bin"
fake_repo="$test_root/repo"
payload_dir="$test_root/payload"
data_dir="$test_root/data"
mkdir -p "$fake_bin" "$fake_repo/scripts" "$payload_dir" "$data_dir"

printf 'from-production\n' >"$payload_dir/production-marker.txt"
printf 'from-local\n' >"$data_dir/local-marker.txt"
cp "$SCRIPT_DIR/pull-prod-state.sh" "$fake_repo/scripts/pull-prod-state.sh"

cat >"$fake_repo/.env" <<ENV
DATA_DIR=$data_dir
KARAKEEP_PROD_SSH_HOST=vps
KARAKEEP_PROD_COMPOSE_DIR=/home/praya/marka
KARAKEEP_PROD_COMPOSE_SERVICE=web
ENV

cat >"$fake_bin/ssh" <<'EOF_SSH'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >"${FAKE_SSH_ARGS:?}"
cat >"${FAKE_REMOTE_SCRIPT:?}"
tar -cf - -C "${FAKE_PAYLOAD:?}" .
EOF_SSH
chmod +x "$fake_bin/ssh"

cat >"$fake_bin/pnpm" <<'EOF_PNPM'
#!/usr/bin/env bash
set -Eeuo pipefail
printf '%s\n' "$*" >"${FAKE_PNPM_ARGS:?}"
EOF_PNPM
chmod +x "$fake_bin/pnpm"

export FAKE_SSH_ARGS="$test_root/ssh-args"
export FAKE_REMOTE_SCRIPT="$test_root/remote-script"
export FAKE_PNPM_ARGS="$test_root/pnpm-args"
export FAKE_PAYLOAD="$payload_dir"
export PATH="$fake_bin:$PATH"

bash "$fake_repo/scripts/pull-prod-state.sh"

assert_contains "$data_dir/production-marker.txt" "from-production"
[[ -d "$data_dir.backups" ]] || fail "Local backup directory was not created"
backup_file="$(find "$data_dir.backups" -name local-marker.txt -print -quit)"
[[ -n "$backup_file" ]] || fail "Previous local data was not backed up"
assert_contains "$backup_file" "from-local"
assert_contains "$FAKE_SSH_ARGS" "KARAKEEP_PROD_COMPOSE_PROJECT=karakeep"
assert_contains "$FAKE_REMOTE_SCRIPT" 'docker compose -p "$project" ps -q "$service"'
assert_contains "$FAKE_REMOTE_SCRIPT" 'docker compose -p "$project" pause "$service"'
assert_contains "$FAKE_REMOTE_SCRIPT" 'docker compose -p "$project" unpause "$service"'
assert_contains "$FAKE_PNPM_ARGS" "db:migrate"

printf 'Production-state pull script tests passed.\n'
