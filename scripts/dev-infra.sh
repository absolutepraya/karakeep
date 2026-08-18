#!/usr/bin/env bash
set -Eeuo pipefail

MEILI_CONTAINER="marka-dev-meilisearch"
CHROME_CONTAINER="marka-dev-chrome"
LEGACY_MEILI_CONTAINER="karakeep-dev-meilisearch"
LEGACY_CHROME_CONTAINER="karakeep-dev-chrome"
MEILI_VOLUME="marka-dev-meilisearch-data"
MEILI_PORT="7700"
CHROME_PORT="${MARKA_DEV_CHROME_PORT:-9223}"
MEILI_IMAGE="getmeili/meilisearch:v1.41.0"
CHROME_IMAGE="ghcr.io/karakeep-app/karakeep-chrome:release"

info() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$CHROME_PORT" =~ ^[0-9]+$ ]] || die "MARKA_DEV_CHROME_PORT must be a port number."

require_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker is not installed. Install Docker first."
  docker info >/dev/null 2>&1 || die "Docker is installed but the current user cannot reach the Docker daemon. Start Docker and retry."
}

container_exists() {
  docker inspect "$1" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" == "true" ]]
}

adopt_legacy_container() {
  local legacy="$1" current="$2"
  if container_exists "$legacy" && ! container_exists "$current"; then
    docker rename "$legacy" "$current" >/dev/null || die "Failed to rename legacy $legacy container to $current."
    info "Renamed legacy $legacy container to $current"
  fi
}

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
    return
  fi
  return 1
}

ensure_available_port() {
  local port="$1" owner="$2"
  if port_in_use "$port"; then
    die "Port $port is already in use by something other than $owner. Stop the conflicting service before starting shared Marka dev infrastructure."
  fi
}

ensure_meilisearch() {
  adopt_legacy_container "$LEGACY_MEILI_CONTAINER" "$MEILI_CONTAINER"
  if container_exists "$MEILI_CONTAINER"; then
    if container_running "$MEILI_CONTAINER"; then
      info "Reusing shared Meilisearch on http://localhost:$MEILI_PORT"
      return
    fi
    ensure_available_port "$MEILI_PORT" "$MEILI_CONTAINER"
    docker start "$MEILI_CONTAINER" >/dev/null || die "Failed to start existing $MEILI_CONTAINER container."
    info "Started existing shared Meilisearch on http://localhost:$MEILI_PORT"
    return
  fi

  ensure_available_port "$MEILI_PORT" "$MEILI_CONTAINER"
  docker run -d \
    --name "$MEILI_CONTAINER" \
    --restart unless-stopped \
    -p "127.0.0.1:$MEILI_PORT:7700" \
    -e MEILI_NO_ANALYTICS=true \
    -v "$MEILI_VOLUME:/meili_data" \
    "$MEILI_IMAGE" >/dev/null || die "Failed to start shared Meilisearch. Check whether port $MEILI_PORT became occupied and retry."
  info "Started shared Meilisearch on http://localhost:$MEILI_PORT"
}

ensure_chrome() {
  adopt_legacy_container "$LEGACY_CHROME_CONTAINER" "$CHROME_CONTAINER"
  if container_exists "$CHROME_CONTAINER"; then
    if container_running "$CHROME_CONTAINER"; then
      info "Reusing shared Chrome on http://localhost:$CHROME_PORT"
      return
    fi
    ensure_available_port "$CHROME_PORT" "$CHROME_CONTAINER"
    docker start "$CHROME_CONTAINER" >/dev/null || die "Failed to start existing $CHROME_CONTAINER container."
    info "Started existing shared Chrome on http://localhost:$CHROME_PORT"
    return
  fi

  ensure_available_port "$CHROME_PORT" "$CHROME_CONTAINER"
  docker run -d \
    --name "$CHROME_CONTAINER" \
    --restart unless-stopped \
    --init \
    -p "127.0.0.1:$CHROME_PORT:9222" \
    "$CHROME_IMAGE" \
    --disable-gpu \
    --disable-dev-shm-usage \
    --hide-scrollbars \
    --disable-blink-features=AutomationControlled \
    --window-size=1440,900 >/dev/null || die "Failed to start shared Chrome. Check whether port $CHROME_PORT became occupied and retry."
  info "Started shared Chrome on http://localhost:$CHROME_PORT"
}

up() {
  require_docker
  ensure_meilisearch
  ensure_chrome
}

status_one() {
  local name="$1" endpoint="$2"
  if ! container_exists "$name"; then
    printf '%-28s %s\n' "$name" "not created"
  elif container_running "$name"; then
    printf '%-28s running  %s\n' "$name" "$endpoint"
  else
    printf '%-28s %s\n' "$name" "stopped"
  fi
}

status() {
  require_docker
  status_one "$MEILI_CONTAINER" "http://localhost:$MEILI_PORT"
  status_one "$CHROME_CONTAINER" "http://localhost:$CHROME_PORT"
}

down() {
  require_docker
  local removed=0
  if container_exists "$MEILI_CONTAINER"; then
    docker rm -f "$MEILI_CONTAINER" >/dev/null
    removed=1
  fi
  if container_exists "$CHROME_CONTAINER"; then
    docker rm -f "$CHROME_CONTAINER" >/dev/null
    removed=1
  fi
  if ((removed)); then
    info "Stopped shared Marka dev infrastructure. Meilisearch data volume $MEILI_VOLUME was preserved."
  else
    info "Shared Marka dev infrastructure is not running."
  fi
}

usage() {
  cat <<'EOF'
Usage: scripts/dev-infra.sh up|status|down

  up      Start or reuse the shared local Meilisearch and Chrome containers.
  status  Show whether the shared containers are running.
  down    Remove the shared containers while preserving the Meilisearch volume.
EOF
}

case "${1:-}" in
  up) up ;;
  status) status ;;
  down) down ;;
  -h|--help) usage ;;
  *) usage >&2; exit 1 ;;
esac
