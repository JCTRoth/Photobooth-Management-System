#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "photobooth-upload.sh now delegates to the signed device client." >&2
echo "Set PHOTOBOOTH_DEVICE_CONFIG to your generated device JSON if needed." >&2

"$SCRIPT_DIR/photobooth-device-hook.sh" "$@"
