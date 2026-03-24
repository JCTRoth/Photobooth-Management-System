#!/usr/bin/env bash
# =============================================================================
# Photobooth Project - Post-Capture Upload Script
# =============================================================================
# This script is triggered after each photo capture by Photobooth Project.
# It uploads the captured image to the photobooth management API.
#
# SETUP:
#   1. Set the PHOTOBOOTH_API_URL and PHOTOBOOTH_EVENT_ID below
#   2. Make executable: chmod +x photobooth-upload.sh
#   3. Configure Photobooth Project to call this script after capture:
#      e.g. in the "Post-processing" command field:
#           /path/to/photobooth-upload.sh {filename}
# =============================================================================

set -euo pipefail

# ──── Configuration ────
PHOTOBOOTH_API_URL="${PHOTOBOOTH_API_URL:-http://photobooth.example.com}"
PHOTOBOOTH_EVENT_ID="${PHOTOBOOTH_EVENT_ID:-}"
LOG_FILE="${PHOTOBOOTH_LOG_FILE:-/tmp/photobooth-upload.log}"
MAX_RETRIES=3
RETRY_DELAY=2

# ──── Functions ────

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

die() {
    log "ERROR: $*"
    exit 1
}

validate_config() {
    if [ -z "$PHOTOBOOTH_EVENT_ID" ]; then
        die "PHOTOBOOTH_EVENT_ID is not set. Export it or set it in this script."
    fi

    if ! command -v curl &>/dev/null; then
        die "curl is required but not installed."
    fi
}

validate_file() {
    local filepath="$1"

    if [ ! -f "$filepath" ]; then
        die "File not found: $filepath"
    fi

    local filesize
    filesize=$(stat -c%s "$filepath" 2>/dev/null || stat -f%z "$filepath" 2>/dev/null)
    if [ "$filesize" -gt 10485760 ]; then
        die "File exceeds 10MB limit: $filepath ($filesize bytes)"
    fi

    local ext="${filepath##*.}"
    ext="${ext,,}"
    case "$ext" in
        jpg|jpeg|png) ;;
        *) die "Unsupported file type: .$ext (only jpg/jpeg/png allowed)" ;;
    esac
}

upload_file() {
    local filepath="$1"
    local attempt=1

    while [ $attempt -le $MAX_RETRIES ]; do
        log "Upload attempt $attempt/$MAX_RETRIES: $(basename "$filepath")"

        local http_code
        local response
        response=$(curl \
            --silent \
            --show-error \
            --write-out "\n%{http_code}" \
            --connect-timeout 10 \
            --max-time 60 \
            -X POST \
            -F "eventId=${PHOTOBOOTH_EVENT_ID}" \
            -F "file=@${filepath}" \
            "${PHOTOBOOTH_API_URL}/api/upload/guest" \
            2>&1) || true

        http_code=$(echo "$response" | tail -n1)
        local body
        body=$(echo "$response" | sed '$d')

        if [ "$http_code" = "200" ]; then
            log "Upload successful: $(basename "$filepath") -> $body"
            return 0
        fi

        log "Upload failed (HTTP $http_code): $body"

        if [ $attempt -lt $MAX_RETRIES ]; then
            log "Retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi

        attempt=$((attempt + 1))
    done

    die "Upload failed after $MAX_RETRIES attempts: $(basename "$filepath")"
}

# ──── Main ────

main() {
    if [ $# -lt 1 ]; then
        echo "Usage: $0 <image_path>"
        echo ""
        echo "Environment variables:"
        echo "  PHOTOBOOTH_API_URL     API base URL (default: http://photobooth.example.com)"
        echo "  PHOTOBOOTH_EVENT_ID    Event UUID (required)"
        echo "  PHOTOBOOTH_LOG_FILE    Log file path (default: /tmp/photobooth-upload.log)"
        exit 1
    fi

    local filepath="$1"

    validate_config
    validate_file "$filepath"
    upload_file "$filepath"
}

main "$@"
