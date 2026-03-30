#!/usr/bin/env bash
set -euo pipefail

. "$(
  cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
)/client-dev-common.sh"

find_latest_image() {
  local search_dir="$1"

  if [ ! -d "$search_dir" ]; then
    return 1
  fi

  find "$search_dir" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr \
    | head -n1 \
    | cut -d' ' -f2-
}

FILE_PATH="${1:-${PHOTOBOOTH_CLIENT_FILE:-}}"

ensure_local_device_config
ensure_api_reachable "upload a file"

if [ -z "$FILE_PATH" ]; then
  FILE_PATH="$(find_latest_image "$WATCH_DIR" || true)"
fi

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  echo "No image file found to upload." >&2
  echo "Place a jpg/png in $WATCH_DIR or set PHOTOBOOTH_CLIENT_FILE=/path/to/image.jpg" >&2
  echo "You can also run: $0 /path/to/image.jpg" >&2
  exit 1
fi

echo "Uploading $FILE_PATH with $CONFIG_PATH"
exec dotnet run --project "$CLIENT_PROJECT_PATH" -- \
  upload-file \
  --config "$CONFIG_PATH" \
  --file "$FILE_PATH"
