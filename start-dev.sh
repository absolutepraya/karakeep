#!/usr/bin/env bash

# Karakeep dev launcher.
#   ./start-dev.sh        foreground — logs in this terminal, Ctrl+C stops everything
#   ./start-dev.sh -d     detached   — frees the shell, logs in .dev/, stop with ./stop-dev.sh

DETACH=0
case "${1:-}" in
    -d|--detach) DETACH=1 ;;
    -h|--help) echo "Usage: ./start-dev.sh [-d|--detach]"; exit 0 ;;
    "") ;;
    *) echo "Unknown option: $1"; echo "Usage: ./start-dev.sh [-d|--detach]"; exit 1 ;;
esac

DEV_DIR=".dev"
mkdir -p "$DEV_DIR"

# Worktrees receive KARAKEEP_PORT, MEILI_ADDR, and BROWSER_WEB_URL from their
# generated .env. The main workspace retains the conventional defaults.
WORKSPACE_NAME="${WT_WORKSPACE_NAME:-main}"
WORKSPACE_SLUG="$(printf '%s' "$WORKSPACE_NAME" | tr -cs '[:alnum:]_.-' '-')"
MEILI_CONTAINER="karakeep-${WORKSPACE_SLUG}-meilisearch"
CHROME_CONTAINER="karakeep-${WORKSPACE_SLUG}-chrome"
WEB_PORT="${KARAKEEP_PORT:-3000}"
MEILI_PORT=7700

if [ -f ".env" ]; then
    _web_port=$(grep "^KARAKEEP_PORT=" .env | cut -d'=' -f2-)
    case "$_web_port" in
        ''|*[!0-9]*) ;;
        *) WEB_PORT="$_web_port" ;;
    esac

    _meili_addr=$(grep "^MEILI_ADDR=" .env | cut -d'=' -f2-)
    _meili_port="${_meili_addr##*:}"; _meili_port="${_meili_port%%/*}"
    case "$_meili_port" in
        ''|*[!0-9]*) ;;
        *) MEILI_PORT="$_meili_port" ;;
    esac
fi

case "$WEB_PORT" in
    ''|*[!0-9]*) echo "Error: KARAKEEP_PORT must be a port number."; exit 1 ;;
esac

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Recursively terminate a process and all its descendants (portable: macOS + Linux).
# pnpm spawns next/tsx children, so killing just the pnpm pid can leave orphans.
kill_tree() {
    local pid="$1" child
    for child in $(pgrep -P "$pid" 2>/dev/null); do
        kill_tree "$child"
    done
    kill "$pid" 2>/dev/null
}

# Headless-Chrome host port: derived from BROWSER_WEB_URL in .env (default 9222).
CHROME_PORT=9222
if [ -f ".env" ]; then
    _bw=$(grep "^BROWSER_WEB_URL=" .env | cut -d'=' -f2-)
    _p="${_bw##*:}"; _p="${_p%%/*}"
    case "$_p" in
        ''|*[!0-9]*) ;;
        *) CHROME_PORT="$_p" ;;
    esac
fi

# Check if Docker is installed
if ! command_exists docker; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if pnpm is installed
if ! command_exists pnpm; then
    echo "Error: pnpm is not installed. Please install pnpm first."
    exit 1
fi

# Start Meilisearch if not already running.
if ! port_in_use "$MEILI_PORT"; then
    echo "Starting Meilisearch on port $MEILI_PORT..."
    docker run -d -p "$MEILI_PORT:7700" --name "$MEILI_CONTAINER" getmeili/meilisearch:v1.41.0
else
    echo "Meilisearch is already running on port $MEILI_PORT"
fi

# Start Chrome if not already running
# Start Chrome if not already running.
if ! port_in_use "$CHROME_PORT"; then
    echo "Starting headless Chrome on port $CHROME_PORT..."
    docker run -d -p "$CHROME_PORT:9222" --name "$CHROME_CONTAINER" gcr.io/zenika-hub/alpine-chrome:124 \
        --no-sandbox \
        --disable-gpu \
        --disable-dev-shm-usage \
        --remote-debugging-address=0.0.0.0 \
        --remote-debugging-port=9222 \
        --hide-scrollbars
else
    echo "Port $CHROME_PORT already in use; assuming a compatible Chrome/CDP is there"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
fi

# Get DATA_DIR from environment or .env file
if [ -z "${DATA_DIR:-}" ] && [ -f ".env" ]; then
    DATA_DIR=$(grep "^DATA_DIR=" .env | cut -d'=' -f2)
fi

# Create DATA_DIR if it doesn't exist
if [ -n "${DATA_DIR:-}" ] && [ ! -d "$DATA_DIR" ]; then
    echo "Creating DATA_DIR at $DATA_DIR..."
    mkdir -p "$DATA_DIR"
fi

echo "Running database migrations..."
pnpm run db:migrate

echo "Starting web app and workers..."
if [ "$DETACH" -eq 1 ]; then
    nohup pnpm --filter @karakeep/web run dev -- --port "$WEB_PORT" > "$DEV_DIR/web.log" 2>&1 & WEB_PID=$!
    nohup pnpm workers > "$DEV_DIR/workers.log" 2>&1 & WORKERS_PID=$!
else
    pnpm --filter @karakeep/web run dev -- --port "$WEB_PORT" & WEB_PID=$!
    pnpm workers & WORKERS_PID=$!
fi
echo "$WEB_PID" > "$DEV_DIR/web.pid"
echo "$WORKERS_PID" > "$DEV_DIR/workers.pid"

# Function to handle script termination (foreground mode)
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill_tree "$WEB_PID"
    kill_tree "$WORKERS_PID"
    docker stop "$MEILI_CONTAINER" "$CHROME_CONTAINER" 2>/dev/null
    docker rm "$MEILI_CONTAINER" "$CHROME_CONTAINER" 2>/dev/null
    rm -f "$DEV_DIR/web.pid" "$DEV_DIR/workers.pid"
    exit 0
}

# Wait for web app to be ready (max 30 seconds)
echo "Waiting for web app to start..."
ATTEMPT=0
while [ $ATTEMPT -lt 30 ]; do
    if nc -z localhost "$WEB_PORT" 2>/dev/null; then
        break
    fi
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
done
if [ $ATTEMPT -eq 30 ]; then
    echo "Warning: Web app may not have started properly after 30 seconds"
fi

echo ""
echo "Development environment is running!"
echo "  Web app:         http://localhost:$WEB_PORT"
echo "  Meilisearch:     http://localhost:$MEILI_PORT"
echo "  Chrome debugger: http://localhost:$CHROME_PORT"

if [ "$DETACH" -eq 1 ]; then
    echo ""
    echo "Running detached (your shell is free)."
    echo "  Logs:  tail -f $DEV_DIR/web.log $DEV_DIR/workers.log"
    echo "  Stop:  ./stop-dev.sh"
    exit 0
else
    # Set up trap to catch termination signals
    trap cleanup SIGINT SIGTERM
    echo "  Press Ctrl+C to stop all services"
    # Wait for user interrupt
    wait
fi
