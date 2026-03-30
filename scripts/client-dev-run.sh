#!/usr/bin/env bash
set -euo pipefail

. "$(
  cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
)/client-dev-common.sh"

WATCH_MODE="${1:-}"

ensure_local_device_config

echo "Running photobooth client with $CONFIG_PATH"

if [ "$WATCH_MODE" = "--watch" ]; then
  exec dotnet watch run --project "$CLIENT_PROJECT_PATH" -- \
    run \
    --config "$CONFIG_PATH"
fi

exec dotnet run --project "$CLIENT_PROJECT_PATH" -- \
  run \
  --config "$CONFIG_PATH"
