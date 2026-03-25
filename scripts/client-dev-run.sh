#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_PATH="${PHOTOBOOTH_CLIENT_CONFIG:-$ROOT_DIR/apps/client/photobooth-device.local.json}"

if [ ! -f "$CONFIG_PATH" ]; then
  echo "No local device config found at $CONFIG_PATH"
  echo "Bootstrapping one automatically for development..."
  "$SCRIPT_DIR/client-dev-register.sh"
fi

echo "Running photobooth client with $CONFIG_PATH"
exec dotnet run --project "$ROOT_DIR/apps/client/Photobooth.Client.csproj" -- \
  run \
  --config "$CONFIG_PATH"
