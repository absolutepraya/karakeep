#!/usr/bin/env bash

# Stop the Karakeep dev environment started by ./start-dev.sh
# (works for detached `-d` runs; also tears down the meilisearch + chrome containers).

DEV_DIR=".dev"

WORKSPACE_NAME="${WT_WORKSPACE_NAME:-main}"
WORKSPACE_SLUG="$(printf '%s' "$WORKSPACE_NAME" | tr -cs '[:alnum:]_.-' '-')"
MEILI_CONTAINER="karakeep-${WORKSPACE_SLUG}-meilisearch"
CHROME_CONTAINER="karakeep-${WORKSPACE_SLUG}-chrome"

# Recursively terminate a process and all its descendants (portable: macOS + Linux).
kill_tree() {
    local pid="$1" child
    for child in $(pgrep -P "$pid" 2>/dev/null); do
        kill_tree "$child"
    done
    kill "$pid" 2>/dev/null
}

stop_proc() {
    local name="$1" file="$DEV_DIR/$2" pid
    if [ -f "$file" ]; then
        pid="$(cat "$file" 2>/dev/null)"
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "Stopping $name (pid $pid)..."
            kill_tree "$pid"
        else
            echo "$name: not running"
        fi
        rm -f "$file"
    else
        echo "$name: no pidfile (was it started with ./start-dev.sh -d?)"
    fi
}

stop_proc "web app" "web.pid"
stop_proc "workers" "workers.pid"

echo "Stopping Meilisearch + Chrome containers..."
docker stop "$MEILI_CONTAINER" "$CHROME_CONTAINER" 2>/dev/null
docker rm "$MEILI_CONTAINER" "$CHROME_CONTAINER" 2>/dev/null

echo "Done. Dev environment stopped."
