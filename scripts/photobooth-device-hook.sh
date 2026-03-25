#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <image_path>" >&2
  exit 1
fi

CONFIG_PATH="${PHOTOBOOTH_DEVICE_CONFIG:-./photobooth-device.json}"

dotnet run --project apps/client/Photobooth.Client.csproj -- \
  upload-file \
  --config "$CONFIG_PATH" \
  --file "$1"
