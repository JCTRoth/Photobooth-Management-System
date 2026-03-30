#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CLIENT_PROJECT_PATH="$ROOT_DIR/apps/client/Photobooth.Client.csproj"
CONFIG_PATH="${PHOTOBOOTH_CLIENT_CONFIG:-$ROOT_DIR/apps/client/photobooth-device.local.json}"
SERVER_URL="${PHOTOBOOTH_CLIENT_SERVER_URL:-http://localhost:5000}"
WATCH_DIR="${PHOTOBOOTH_CLIENT_WATCH_DIR:-/tmp/photobooth}"
BASE_NAME="${PHOTOBOOTH_CLIENT_DEVICE_NAME:-$(hostname -s 2>/dev/null || echo dev)-booth}"

trim_trailing_slash() {
  local value="$1"
  value="${value%/}"
  printf '%s' "$value"
}

api_health_url() {
  printf '%s/api/health' "$(trim_trailing_slash "$SERVER_URL")"
}

ensure_api_reachable() {
  local purpose="$1"

  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi

  if curl --silent --show-error --fail --max-time 2 "$(api_health_url)" >/dev/null 2>&1; then
    return 0
  fi

  echo "The API at $SERVER_URL is not reachable, so the client cannot ${purpose}." >&2
  echo "Start it with: npx nx run api:dev" >&2
  echo "For the admin UI with Vite hot reload, also run: npx nx run web:dev" >&2
  exit 1
}

ensure_local_device_config() {
  if [ -f "$CONFIG_PATH" ]; then
    return 0
  fi

  echo "No local device config found at $CONFIG_PATH"
  echo "Bootstrapping one automatically for development..."
  "$SCRIPT_DIR/client-dev-register.sh"
}
