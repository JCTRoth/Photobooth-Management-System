# Development Guide

This document is the practical day-to-day guide for working on the photobooth platform locally.

## Workspace Overview

- `apps/api`: ASP.NET Core backend, EF Core migrations, auth, SFTP, device APIs
- `apps/web`: React admin panel and public pages
- `apps/client`: signed photobooth device client
- `infra/k8s`: deployment manifests
- `scripts`: shell hooks for Photobooth Project integration

## Prerequisites

- .NET 8 SDK
- Node.js 20+
- npm
- Docker and Docker Compose
- `dotnet-ef` installed at `~/.dotnet/tools/dotnet-ef`

If `dotnet ef` fails because of runtime resolution, use the workspace scripts:

```bash
npm run api:migrate
npm run api:db-update
```

They already set `DOTNET_ROOT=/usr/share/dotnet`.

## First-Time Setup

### 1. Install frontend dependencies

```bash
npm --prefix apps/web install
```

### 2. Start PostgreSQL

```bash
docker compose up db -d
```

### 3. Apply migrations

```bash
npm run api:db-update
```

### 4. Start the backend

```bash
npx nx run api:watch
```

The API listens on `http://localhost:5000`.

### 5. Start the frontend

```bash
npx nx run web:dev
```

The Vite app listens on `http://localhost:5173`.

### 6. Optional: run the device client

```bash
npx nx run client:register
npx nx run client:run
npx nx run client:upload-file
```

The Nx client targets now use a local config at `apps/client/photobooth-device.local.json`.

- `client:register` is idempotent for local development and reuses the config if it already exists.
- `client:run` auto-registers a local device if no config exists yet.
- `client:upload-file` uses the newest jpg/png from `/tmp/photobooth` by default, or `PHOTOBOOTH_CLIENT_FILE`.

For real setups, pass your own server URL, config path, and watch directory with the raw `dotnet run` command.

## Recommended Development Workflow

### Backend

Use hot reload:

```bash
npx nx run api:watch
```

Useful commands:

```bash
npx nx run api:build
npm run api:db-update
npm run api:migrate
```

### Frontend

Use Vite in dev mode:

```bash
npx nx run web:dev
```

Production build:

```bash
npx nx run web:build
```

### Device Client

Build:

```bash
npx nx run client:build
```

Run with a real config:

```bash
dotnet run --project apps/client/Photobooth.Client.csproj -- run --config ./device.json
```

Register a new local device:

```bash
dotnet run --project apps/client/Photobooth.Client.csproj -- register --server-url http://localhost:5000 --device-name "Booth 01" --config ./device.json --watch-dir /tmp/photobooth
```

Upload a single file manually:

```bash
dotnet run --project apps/client/Photobooth.Client.csproj -- upload-file --config ./device.json --file ./capture.jpg
```

Useful dev overrides:

```bash
PHOTOBOOTH_CLIENT_SERVER_URL=http://localhost:5000 npx nx run client:register
PHOTOBOOTH_CLIENT_DEVICE_NAME="Studio Booth" npx nx run client:register
PHOTOBOOTH_CLIENT_WATCH_DIR=/tmp/photobooth npx nx run client:run
PHOTOBOOTH_CLIENT_FILE=/path/to/capture.jpg npx nx run client:upload-file
```

## Authentication Notes

### Admin bootstrap

On a fresh database:

```text
identifier: Admin
password:   Admin
```

The first login requires a password change.

### Device signing

Device requests are signed with RSA-PSS using:

```text
METHOD
/path?query
timestamp
nonce
SHA256(body)
```

If device auth fails, compare:

- request path and query
- exact timestamp string
- SHA-256 casing
- the stored public key vs device private key

## Developing Device Features

Typical loop:

1. Provision a device in `/admin/devices` or via `register`.
2. Assign an event in the admin UI.
3. Start the client with `run`.
4. Drop a JPEG or PNG into the configured watch directory.
5. Verify the image appears in the event detail page and storage backend.

For Photobooth Project integration, point post-processing at:

```bash
PHOTOBOOTH_DEVICE_CONFIG=/path/to/device.json ./scripts/photobooth-device-hook.sh "{filename}"
```

## Database and Migrations

Device tables added for the distributed-client flow:

- `devices`
- `device_request_nonces`

When changing EF models:

```bash
npm run api:migrate
npm run api:db-update
```

Commit both:

- migration `.cs`
- migration `.Designer.cs`
- `PhotoboothDbContextModelSnapshot.cs`

## Verification Checklist

Run these before wrapping up a feature:

```bash
dotnet build apps/api/Photobooth.Api.csproj
dotnet build apps/client/Photobooth.Client.csproj
npm --prefix apps/web run build
npm run test:stack
```

For device/auth changes, also verify:

- device registration works
- `run` sends successful heartbeats
- assigned event uploads succeed
- deleted devices can no longer authenticate

## Common Gotchas

- `localhost` only works for a booth running on the same machine as the API.
- The device JSON private key is only returned once when the backend generates it.
- Vite proxy issues usually mean the frontend dev server needs a restart after config changes.
- If `dotnet watch` reports a rude edit, restart it once and continue.
- The Nx client targets are intentionally local-dev helpers; production booths should use explicit config paths and device names.
