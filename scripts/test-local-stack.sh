#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

RUN_DIR="${PHOTOBOOTH_TEST_RUN_DIR:-$(mktemp -d /tmp/photobooth-stack-XXXXXX)}"
RUN_ID="$(basename "$RUN_DIR")"

API_PORT="${PHOTOBOOTH_TEST_API_PORT:-5500}"
WEB_PORT="${PHOTOBOOTH_TEST_WEB_PORT:-5174}"
DB_PORT="${PHOTOBOOTH_TEST_DB_PORT:-55433}"
DB_NAME="${PHOTOBOOTH_TEST_DB_NAME:-photobooth_test}"
DB_USER="${PHOTOBOOTH_TEST_DB_USER:-photobooth}"
DB_PASS="${PHOTOBOOTH_TEST_DB_PASS:-changeme}"
ADMIN_NEW_PASSWORD="${PHOTOBOOTH_TEST_ADMIN_PASSWORD:-AdminTestPassword123!}"

API_URL="http://127.0.0.1:${API_PORT}"
WEB_URL="http://127.0.0.1:${WEB_PORT}"
DB_CONTAINER="photobooth-test-${RUN_ID//[^a-zA-Z0-9]/}"
DEVICE_NAME="test-booth-${RUN_ID}"
CONFIG_PATH="${RUN_DIR}/photobooth-device.json"
WATCH_DIR="${RUN_DIR}/watch"
SAMPLE_IMAGE="${RUN_DIR}/sample.png"
UPLOADS_ROOT="${ROOT_DIR}/apps/api/wwwroot/uploads"

API_LOG="${RUN_DIR}/api.log"
WEB_LOG="${RUN_DIR}/web.log"
CLIENT_LOG="${RUN_DIR}/client.log"
REGISTER_LOG="${RUN_DIR}/register.log"
UPLOAD_LOG="${RUN_DIR}/upload.log"
WEB_INSTALL_LOG="${RUN_DIR}/web-install.log"
LAST_RESPONSE_FILE="${RUN_DIR}/last-response.json"
DOWNLOADED_IMAGE="${RUN_DIR}/downloaded-image.bin"
DOWNLOADED_ZIP="${RUN_DIR}/download.zip"

STEP_INDEX=0
API_PID=""
WEB_PID=""
CLIENT_PID=""
DEVICE_ID=""
EVENT_ID=""
IMAGE_ID=""
ADMIN_TOKEN=""

step() {
  STEP_INDEX=$((STEP_INDEX + 1))
  printf '\n[%02d] %s\n' "$STEP_INDEX" "$1"
}

note() {
  printf '     %s\n' "$1"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

ensure_port_free() {
  local port="$1"
  local label="$2"

  if ! command -v ss >/dev/null 2>&1; then
    return 0
  fi

  if ss -ltn "( sport = :${port} )" 2>/dev/null | awk 'NR > 1 { found = 1 } END { exit(found ? 0 : 1) }'; then
    echo "${label} port ${port} is already in use. Override it with the matching PHOTOBOOTH_TEST_*_PORT variable." >&2
    exit 1
  fi
}

json_get() {
  local path="$1"
  node -e '
const fs = require("fs");

const path = process.argv[1];
const input = fs.readFileSync(0, "utf8").trim();

if (!input) {
  process.exit(1);
}

const data = JSON.parse(input);
let value = data;

for (const segment of path.split(".")) {
  if (!segment) continue;
  const match = segment.match(/^([^[\]]+)\[(\d+)\]$/);
  if (match) {
    value = value?.[match[1]]?.[Number(match[2])];
  } else {
    value = value?.[segment];
  }
}

if (value === undefined || value === null) {
  process.exit(1);
}

if (typeof value === "object") {
  process.stdout.write(JSON.stringify(value));
} else {
  process.stdout.write(String(value));
}
' "$path"
}

http_ok() {
  local url="$1"
  local status

  status="$(curl -sS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"
  [[ "$status" == 2* || "$status" == 3* ]]
}

http_json() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  shift 3 || true

  local curl_args=(
    -sS
    -o "$LAST_RESPONSE_FILE"
    -w '%{http_code}'
    -X "$method"
    "$url"
    -H 'Accept: application/json'
  )

  if [ -n "$body" ]; then
    curl_args+=(-H 'Content-Type: application/json' --data "$body")
  fi

  while [ "$#" -gt 0 ]; do
    curl_args+=(-H "$1")
    shift
  done

  local status
  status="$(curl "${curl_args[@]}")"

  if [[ "$status" != 2* ]]; then
    echo "Request failed: ${method} ${url} -> HTTP ${status}" >&2
    cat "$LAST_RESPONSE_FILE" >&2 || true
    return 1
  fi

  cat "$LAST_RESPONSE_FILE"
}

wait_for() {
  local label="$1"
  local timeout_seconds="$2"
  shift 2

  local deadline=$((SECONDS + timeout_seconds))
  until "$@"; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "Timed out waiting for ${label}." >&2
      return 1
    fi
    sleep 1
  done
}

device_online() {
  local device_json
  local connectivity

  device_json="$(http_json GET "${API_URL}/api/devices/${DEVICE_ID}" "" "Authorization: Bearer ${ADMIN_TOKEN}")"
  connectivity="$(printf '%s' "$device_json" | json_get 'connectivity' || true)"

  [[ "$connectivity" == "online" ]]
}

event_has_image() {
  local images_json
  local total

  images_json="$(http_json GET "${API_URL}/api/events/${EVENT_ID}/images" "")"
  total="$(printf '%s' "$images_json" | json_get 'total' || echo 0)"

  if [ "${total}" -lt 1 ]; then
    return 1
  fi

  IMAGE_ID="$(printf '%s' "$images_json" | json_get 'images[0].id')"
  return 0
}

write_sample_image() {
  cat <<'EOF' | base64 -d > "$SAMPLE_IMAGE"
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P1NangAAAABJRU5ErkJggg==
EOF
}

show_log_tail() {
  local label="$1"
  local file_path="$2"

  if [ -f "$file_path" ]; then
    echo "--- ${label} (${file_path}) ---" >&2
    tail -n 40 "$file_path" >&2 || true
  fi
}

cleanup() {
  local exit_code="$?"
  set +e

  if [ -n "$CLIENT_PID" ] && kill -0 "$CLIENT_PID" 2>/dev/null; then
    kill "$CLIENT_PID" 2>/dev/null || true
    wait "$CLIENT_PID" 2>/dev/null || true
  fi

  if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
    wait "$WEB_PID" 2>/dev/null || true
  fi

  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi

  if [ -n "$DB_CONTAINER" ]; then
    docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
  fi

  if [ -n "$EVENT_ID" ] && [ -d "${UPLOADS_ROOT}/${EVENT_ID}" ]; then
    rm -rf "${UPLOADS_ROOT}/${EVENT_ID}"
  fi

  if [ "$exit_code" -ne 0 ]; then
    echo >&2
    echo "Local stack test failed. Logs are in ${RUN_DIR}" >&2
    show_log_tail "API log" "$API_LOG"
    show_log_tail "Web log" "$WEB_LOG"
    show_log_tail "Client log" "$CLIENT_LOG"
    show_log_tail "Register log" "$REGISTER_LOG"
    show_log_tail "Upload log" "$UPLOAD_LOG"
  else
    echo
    echo "Local stack test passed. Logs and temp files are in ${RUN_DIR}"
  fi
}

trap cleanup EXIT

require_command docker
require_command curl
require_command dotnet
require_command node
require_command npm
require_command base64

ensure_port_free "$API_PORT" "API"
ensure_port_free "$WEB_PORT" "Web"
ensure_port_free "$DB_PORT" "Database"

mkdir -p "$RUN_DIR" "$WATCH_DIR"

step "Starting isolated PostgreSQL"
note "Container: ${DB_CONTAINER}"
note "Database URL: postgresql://${DB_USER}:***@127.0.0.1:${DB_PORT}/${DB_NAME}"

docker run -d --rm \
  --name "$DB_CONTAINER" \
  -e POSTGRES_DB="$DB_NAME" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  -p "127.0.0.1:${DB_PORT}:5432" \
  postgres:16-alpine >/dev/null

wait_for "PostgreSQL readiness" 60 docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1

if [ ! -d "${ROOT_DIR}/apps/web/node_modules" ]; then
  step "Installing frontend dependencies"
  npm --prefix "$ROOT_DIR/apps/web" install >"$WEB_INSTALL_LOG" 2>&1
  note "Install log: ${WEB_INSTALL_LOG}"
fi

step "Starting API"
note "URL: ${API_URL}"

(
  cd "$ROOT_DIR"
  ASPNETCORE_ENVIRONMENT=Development \
  ASPNETCORE_URLS="$API_URL" \
  ConnectionStrings__DefaultConnection="Host=127.0.0.1;Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASS}" \
  AppBaseUrl="$WEB_URL" \
  Cors__Origins__0="$WEB_URL" \
  dotnet run --project apps/api/Photobooth.Api.csproj --no-launch-profile
) >"$API_LOG" 2>&1 &
API_PID="$!"

wait_for "API health endpoint" 90 http_ok "${API_URL}/api/health"
note "API log: ${API_LOG}"

step "Starting web dev server"
note "URL: ${WEB_URL}"

(
  cd "$ROOT_DIR"
  VITE_API_PROXY_TARGET="$API_URL" \
  npm --prefix apps/web run dev -- --host 127.0.0.1 --strictPort --port "$WEB_PORT"
) >"$WEB_LOG" 2>&1 &
WEB_PID="$!"

wait_for "web root" 90 http_ok "${WEB_URL}"
wait_for "web API proxy" 90 http_ok "${WEB_URL}/api/health"

WEB_HTML="$(curl -fsS "${WEB_URL}")"
if ! grep -q '<title>Photobooth</title>' <<<"$WEB_HTML"; then
  echo "The web server responded, but the expected Photobooth HTML shell was not returned." >&2
  exit 1
fi

note "Web log: ${WEB_LOG}"

step "Registering an isolated test device"
(
  cd "$ROOT_DIR"
  PHOTOBOOTH_CLIENT_CONFIG="$CONFIG_PATH" \
  PHOTOBOOTH_CLIENT_SERVER_URL="$API_URL" \
  PHOTOBOOTH_CLIENT_WATCH_DIR="$WATCH_DIR" \
  PHOTOBOOTH_CLIENT_DEVICE_NAME="$DEVICE_NAME" \
  bash ./scripts/client-dev-register.sh
) >"$REGISTER_LOG" 2>&1

DEVICE_ID="$(cat "$CONFIG_PATH" | json_get 'deviceId')"
note "Device ID: ${DEVICE_ID}"
note "Device config: ${CONFIG_PATH}"

step "Starting the long-running photobooth client"
(
  cd "$ROOT_DIR"
  PHOTOBOOTH_CLIENT_CONFIG="$CONFIG_PATH" \
  PHOTOBOOTH_CLIENT_WATCH_DIR="$WATCH_DIR" \
  bash ./scripts/client-dev-run.sh
) >"$CLIENT_LOG" 2>&1 &
CLIENT_PID="$!"

step "Authenticating the bootstrap admin"
LOGIN_BODY="$(IDENTIFIER=Admin PASSWORD=Admin node -e 'console.log(JSON.stringify({ identifier: process.env.IDENTIFIER, password: process.env.PASSWORD }))')"
LOGIN_JSON="$(http_json POST "${API_URL}/api/auth/admin/login" "$LOGIN_BODY")"
ADMIN_TOKEN="$(printf '%s' "$LOGIN_JSON" | json_get 'accessToken')"

if [[ "$(printf '%s' "$LOGIN_JSON" | json_get 'mustChangePassword' || echo false)" == "true" ]]; then
  CHANGE_BODY="$(
    CURRENT_PASSWORD=Admin \
    NEW_PASSWORD="$ADMIN_NEW_PASSWORD" \
    EMAIL=admin@example.test \
    node -e 'console.log(JSON.stringify({ currentPassword: process.env.CURRENT_PASSWORD, newPassword: process.env.NEW_PASSWORD, email: process.env.EMAIL }))'
  )"
  http_json POST "${API_URL}/api/auth/admin/change-password" "$CHANGE_BODY" "Authorization: Bearer ${ADMIN_TOKEN}" >/dev/null

  LOGIN_BODY="$(
    IDENTIFIER=Admin \
    PASSWORD="$ADMIN_NEW_PASSWORD" \
    node -e 'console.log(JSON.stringify({ identifier: process.env.IDENTIFIER, password: process.env.PASSWORD }))'
  )"
  LOGIN_JSON="$(http_json POST "${API_URL}/api/auth/admin/login" "$LOGIN_BODY")"
  ADMIN_TOKEN="$(printf '%s' "$LOGIN_JSON" | json_get 'accessToken')"
fi

note "Admin token issued successfully"

step "Waiting for the running client to send heartbeats"
wait_for "device heartbeat" 90 device_online
note "The device is visible as online in the API"

step "Creating a test event"
EVENT_BODY="$(
  EVENT_NAME="Stack Test ${RUN_ID}" \
  EVENT_DATE="$(date +%F)" \
  node -e 'console.log(JSON.stringify({ name: process.env.EVENT_NAME, date: process.env.EVENT_DATE, retentionDays: 7, slideshowAlbums: [] }))'
)"
EVENT_JSON="$(http_json POST "${API_URL}/api/events" "$EVENT_BODY" "Authorization: Bearer ${ADMIN_TOKEN}")"
EVENT_ID="$(printf '%s' "$EVENT_JSON" | json_get 'id')"
note "Event ID: ${EVENT_ID}"

step "Assigning the event to the device"
ASSIGN_BODY="$(EVENT_ID="$EVENT_ID" node -e 'console.log(JSON.stringify({ eventId: process.env.EVENT_ID }))')"
ASSIGN_JSON="$(http_json PUT "${API_URL}/api/devices/${DEVICE_ID}/assignment" "$ASSIGN_BODY" "Authorization: Bearer ${ADMIN_TOKEN}")"

if [ "$(printf '%s' "$ASSIGN_JSON" | json_get 'assignedEvent.eventId')" != "$EVENT_ID" ]; then
  echo "Device assignment response did not include the expected event." >&2
  exit 1
fi

CONFIG_JSON="$(http_json GET "${API_URL}/api/devices/${DEVICE_ID}/config" "" "Authorization: Bearer ${ADMIN_TOKEN}")"
if [ "$(printf '%s' "$CONFIG_JSON" | json_get 'assignedEvent.eventId')" != "$EVENT_ID" ]; then
  echo "Device config did not reflect the assigned event." >&2
  exit 1
fi

step "Uploading a sample image with the client"
write_sample_image
(
  cd "$ROOT_DIR"
  PHOTOBOOTH_CLIENT_CONFIG="$CONFIG_PATH" \
  bash ./scripts/client-dev-upload.sh "$SAMPLE_IMAGE"
) >"$UPLOAD_LOG" 2>&1

wait_for "image to appear in the event gallery" 60 event_has_image
note "Image ID: ${IMAGE_ID}"

step "Verifying public download endpoints through the web proxy"
DOWNLOAD_JSON="$(http_json GET "${WEB_URL}/d/${IMAGE_ID}" "")"

if [ "$(printf '%s' "$DOWNLOAD_JSON" | json_get 'id')" != "$IMAGE_ID" ]; then
  echo "Download endpoint returned the wrong image metadata." >&2
  exit 1
fi

IMAGE_URL_PATH="$(printf '%s' "$DOWNLOAD_JSON" | json_get 'imageUrl')"
ZIP_URL_PATH="$(printf '%s' "$DOWNLOAD_JSON" | json_get 'zipUrl')"

curl -fsS "${WEB_URL}${IMAGE_URL_PATH}" -o "$DOWNLOADED_IMAGE"
curl -fsS "${WEB_URL}${ZIP_URL_PATH}" -o "$DOWNLOADED_ZIP"

if [ ! -s "$DOWNLOADED_IMAGE" ]; then
  echo "Image download completed but returned an empty file." >&2
  exit 1
fi

if [ ! -s "$DOWNLOADED_ZIP" ]; then
  echo "ZIP download completed but returned an empty file." >&2
  exit 1
fi

step "Test flow complete"
note "API: ${API_URL}"
note "Web: ${WEB_URL}"
note "Logs: ${RUN_DIR}"
