#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA="$SCRIPT_DIR/dev-infra.sh"
SETUP_WORKTREE="$SCRIPT_DIR/setup-worktree.sh"
START_DEV="$REPO_ROOT/start-dev.sh"
STOP_DEV="$REPO_ROOT/stop-dev.sh"
PACKAGE_JSON="$REPO_ROOT/package.json"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local file_or_text="$1" expected="$2"
  if [[ -f "$file_or_text" ]]; then
    grep -Fq -- "$expected" "$file_or_text" || fail "Expected '$expected' in $file_or_text"
  else
    grep -Fq -- "$expected" <<<"$file_or_text" || fail "Expected '$expected' in output"
  fi
}

assert_not_contains() {
  local file_or_text="$1" unexpected="$2"
  if [[ -f "$file_or_text" ]]; then
    ! grep -Fq -- "$unexpected" "$file_or_text" || fail "Did not expect '$unexpected' in $file_or_text"
  else
    ! grep -Fq -- "$unexpected" <<<"$file_or_text" || fail "Did not expect '$unexpected' in output"
  fi
}

root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
fake_bin="$root/bin"
state_dir="$root/docker-state"
mkdir -p "$fake_bin" "$state_dir"

cat >"$fake_bin/docker" <<'EOF_DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail
state_dir="${FAKE_DOCKER_STATE:?}"
log="${FAKE_DOCKER_LOG:?}"
printf '%q ' "$@" >>"$log"
printf '\n' >>"$log"

case "${1:-}" in
  info)
    exit 0
    ;;
  inspect)
    if [[ "${2:-}" == "-f" ]]; then
      name="${4:-}"
      [[ -f "$state_dir/$name" ]] || exit 1
      printf '%s\n' "$(cat "$state_dir/$name")"
      exit 0
    fi
    name="${2:-}"
    [[ -f "$state_dir/$name" ]]
    ;;
  start)
    name="${2:?}"
    [[ -f "$state_dir/$name" ]] || exit 1
    printf 'true\n' >"$state_dir/$name"
    ;;
  run)
    name=""
    args=("$@")
    for ((i = 1; i < ${#args[@]}; i++)); do
      if [[ "${args[$i]}" == "--name" ]]; then
        name="${args[$((i + 1))]}"
        break
      fi
    done
    [[ -n "$name" ]] || exit 2
    printf 'true\n' >"$state_dir/$name"
    printf 'fake-container-id\n'
    ;;
  rm)
    name="${@: -1}"
    rm -f "$state_dir/$name"
    ;;
  ps)
    for file in "$state_dir"/*; do
      [[ -e "$file" ]] || continue
      if [[ "$(cat "$file")" == "true" ]]; then
        basename "$file"
      fi
    done
    ;;
  *)
    exit 0
    ;;
esac
EOF_DOCKER
chmod +x "$fake_bin/docker"

cat >"$fake_bin/lsof" <<'EOF_LSOF'
#!/usr/bin/env bash
set -Eeuo pipefail
port=""
for arg in "$@"; do
  case "$arg" in
    -iTCP:*) port="${arg#-iTCP:}" ;;
    -i:*) port="${arg#-i:}" ;;
  esac
done
case ",${FAKE_BUSY_PORTS:-}," in
  *",$port,"*) exit 0 ;;
  *) exit 1 ;;
esac
EOF_LSOF
chmod +x "$fake_bin/lsof"

export PATH="$fake_bin:$PATH"
export FAKE_DOCKER_STATE="$state_dir"
export FAKE_DOCKER_LOG="$root/docker.log"
: >"$FAKE_DOCKER_LOG"

[[ -f "$INFRA" ]] || fail "Missing scripts/dev-infra.sh"
bash -n "$INFRA" "$SETUP_WORKTREE" "$START_DEV" "$STOP_DEV"

# Shared infra starts exactly one stable Meilisearch and Chrome container.
bash "$INFRA" up >/dev/null
assert_contains "$FAKE_DOCKER_LOG" "karakeep-dev-meilisearch"
assert_contains "$FAKE_DOCKER_LOG" "127.0.0.1:7700:7700"
assert_contains "$FAKE_DOCKER_LOG" "getmeili/meilisearch:v1.41.0"
assert_contains "$FAKE_DOCKER_LOG" "karakeep-dev-chrome"
assert_contains "$FAKE_DOCKER_LOG" "127.0.0.1:9222:9222"
assert_contains "$FAKE_DOCKER_LOG" "ghcr.io/karakeep-app/karakeep-chrome:release"

first_run_count="$(grep -c '^run ' "$FAKE_DOCKER_LOG" || true)"
bash "$INFRA" up >/dev/null
second_run_count="$(grep -c '^run ' "$FAKE_DOCKER_LOG" || true)"
[[ "$first_run_count" == "$second_run_count" ]] || fail "Repeated infra up created duplicate containers"

# A foreign listener blocks creation instead of being silently reused.
rm -f "$state_dir/karakeep-dev-meilisearch" "$state_dir/karakeep-dev-chrome"
: >"$FAKE_DOCKER_LOG"
if FAKE_BUSY_PORTS=7700 bash "$INFRA" up >"$root/foreign.out" 2>&1; then
  fail "Shared infra unexpectedly reused a foreign listener on port 7700"
fi
assert_contains "$root/foreign.out" "Port 7700 is already in use"

# Worktrees share infra endpoints but retain unique web/data state and a Meilisearch-safe namespace.
main_root="$root/main"
workspace="$root/worktree"
mkdir -p "$main_root" "$workspace"
printf 'NEXTAUTH_SECRET=dev-secret\n' >"$main_root/.env"
WT_ROOT_PATH="$main_root" \
WT_WORKSPACE_PATH="$workspace" \
WT_WORKSPACE_NAME='Issue/ABC.weird' \
WT_PORT_BASE=7 \
"$SETUP_WORKTREE" >/dev/null
assert_contains "$workspace/.env" "KARAKEEP_PORT=3007"
assert_contains "$workspace/.env" "DATA_DIR=$workspace/.data/local"
assert_contains "$workspace/.env" "MEILI_ADDR=http://localhost:7700"
assert_contains "$workspace/.env" "BROWSER_WEB_URL=http://localhost:9222"
assert_contains "$workspace/.env" "MEILI_INDEX_PREFIX=issue-abc-weird-7_"
assert_not_contains "$workspace/.env" "MEILI_INDEX_PREFIX=issue-abc.weird-7_"
assert_not_contains "$workspace/.env" "http://localhost:7707"
assert_not_contains "$workspace/.env" "http://localhost:9229"

# Workspace lifecycle delegates shared infra startup and never tears it down implicitly.
assert_contains "$START_DEV" 'scripts/dev-infra.sh" up'
assert_not_contains "$START_DEV" "gcr.io/zenika-hub/alpine-chrome:124"
assert_not_contains "$STOP_DEV" 'docker stop "$MEILI_CONTAINER"'
assert_not_contains "$STOP_DEV" 'docker stop "$CHROME_CONTAINER"'
assert_not_contains "$STOP_DEV" 'docker rm "$MEILI_CONTAINER"'
assert_not_contains "$STOP_DEV" 'docker rm "$CHROME_CONTAINER"'
assert_contains "$PACKAGE_JSON" '"dev:infra:up": "bash scripts/dev-infra.sh up"'
assert_contains "$PACKAGE_JSON" '"dev:infra:status": "bash scripts/dev-infra.sh status"'
assert_contains "$PACKAGE_JSON" '"dev:infra:down": "bash scripts/dev-infra.sh down"'

# Explicit down owns only the shared infra containers.
: >"$FAKE_DOCKER_LOG"
printf 'true\n' >"$state_dir/karakeep-dev-meilisearch"
printf 'true\n' >"$state_dir/karakeep-dev-chrome"
bash "$INFRA" down >/dev/null
assert_contains "$FAKE_DOCKER_LOG" "rm -f karakeep-dev-meilisearch"
assert_contains "$FAKE_DOCKER_LOG" "rm -f karakeep-dev-chrome"

printf 'Shared dev infrastructure tests passed.\n'
