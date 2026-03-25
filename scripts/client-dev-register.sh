#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CONFIG_PATH="${PHOTOBOOTH_CLIENT_CONFIG:-$ROOT_DIR/apps/client/photobooth-device.local.json}"
SERVER_URL="${PHOTOBOOTH_CLIENT_SERVER_URL:-http://localhost:5000}"
WATCH_DIR="${PHOTOBOOTH_CLIENT_WATCH_DIR:-/tmp/photobooth}"
BASE_NAME="${PHOTOBOOTH_CLIENT_DEVICE_NAME:-$(hostname -s 2>/dev/null || echo dev)-booth}"

mkdir -p "$(dirname "$CONFIG_PATH")" "$WATCH_DIR"

if [ -f "$CONFIG_PATH" ]; then
  echo "Using existing local device config: $CONFIG_PATH"
  exit 0
fi

timestamp="$(date +%Y%m%d-%H%M%S)"

for attempt in 0 1 2 3 4; do
  if [ "$attempt" -eq 0 ]; then
    device_name="$BASE_NAME"
  else
    device_name="${BASE_NAME}-${timestamp}-${attempt}"
  fi

  echo "Registering local dev device \"$device_name\"..."

  set +e
  output="$(
    dotnet run --project "$ROOT_DIR/apps/client/Photobooth.Client.csproj" -- \
      register \
      --server-url "$SERVER_URL" \
      --device-name "$device_name" \
      --config "$CONFIG_PATH" \
      --watch-dir "$WATCH_DIR" \
      2>&1
  )"
  status=$?
  set -e

  printf '%s\n' "$output"

  if [ "$status" -eq 0 ]; then
    echo "Local device config created at $CONFIG_PATH"
    exit 0
  fi

  if [[ "$output" != *"already exists"* ]]; then
    exit "$status"
  fi
done

echo "Failed to auto-pick a unique local device name." >&2
echo "Set PHOTOBOOTH_CLIENT_DEVICE_NAME to a custom value and retry." >&2
exit 1
