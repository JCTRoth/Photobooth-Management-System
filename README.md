# Photobooth Management System

Production-ready wedding photobooth platform for managing multiple booth devices, central event assignments, signed guest uploads, QR downloads, and SFTP-backed image storage.

## Screenshots

Screenshots from development and the admin panel:

![Upload flow and SFTP storage preview](docs/2026-03-25_17-15.png)


## Architecture

```text
                          ┌───────────────────────────────┐
                          │       React Admin Panel       │
                          │      /admin, /admin/devices   │
                          └──────────────┬────────────────┘
                                         │ HTTPS
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              ASP.NET Core API                               │
│  JWT admin auth • device signature verification • event management • SFTP   │
│  device registration • heartbeat tracking • signed upload validation        │
└──────────────┬───────────────────────────────┬───────────────────────────────┘
               │                               │
               │ EF Core / Npgsql             │ SSH / SFTP
               ▼                               ▼
      ┌──────────────────┐            ┌──────────────────────┐
      │   PostgreSQL 16   │            │   SFTP image store   │
      │ events/devices/...│            │ /weddings/{eventId}  │
      └──────────────────┘            └──────────────────────┘
               ▲
               │ HTTPS + RSA signatures + nonce + timestamp
               │
    ┌──────────┴──────────┐
    │ Photobooth clients  │
    │ register • heartbeat│
    │ fetch config • upload
    └─────────────────────┘
```

## Core Components

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core 8, EF Core, Npgsql |
| Admin UI | React 18, TypeScript, Vite |
| Device client | .NET 8 console client |
| Database | PostgreSQL 16 |
| Storage | SFTP |
| Deployment | Kubernetes |

## Repository Layout

```text
apps/
  api/       ASP.NET Core API, EF migrations, services, controllers
  web/       React admin panel and public pages
  client/    Signed photobooth device client
infra/k8s/   Kubernetes manifests
scripts/     Photobooth Project hook scripts
docs/        Architecture and development documentation
```

## Documentation

- [Development Guide](./docs/development.md)
- [Client README](./apps/client/README.md)

## Local Development

### 1. Start PostgreSQL

```bash
docker compose up db -d
```

### 2. Apply database migrations

```bash
npm run api:db-update
```

### 3. Start the API with hot reload

```bash
npm run api:watch
```

The API listens on `http://localhost:5000`.

### 4. Start the frontend

```bash
npm --prefix apps/web install
npx nx run web:dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` to the API.

### 5. Bootstrap admin access

On a fresh database the API creates the first admin automatically:

```text
identifier: Admin
password:   Admin
```

The first login forces a password change.

### 6. Provision and run a photobooth client

```bash
npx nx run client:register
npx nx run client:run
npx nx run client:upload-file
```

You can also use the admin panel at `/admin/devices` to provision a device package and download the JSON config.
The Nx targets use a local dev config at `apps/client/photobooth-device.local.json` and will auto-bootstrap it when needed.
For custom parameters, use the raw `dotnet run --project apps/client/Photobooth.Client.csproj -- ...` commands from [apps/client/README.md](./apps/client/README.md).

## Device Workflow

### Registration

`POST /api/devices/register`

- Creates the device record
- Stores the public key
- Returns the device ID
- Returns the private key once if the backend generated the keypair

### Request Signing

Every device request includes:

- `X-Photobooth-Device-Id`
- `X-Photobooth-Timestamp`
- `X-Photobooth-Nonce`
- `X-Photobooth-Signature`

Canonical signature input:

```text
METHOD
/path?query
timestamp
nonce
SHA256(body)
```

The backend verifies the RSA-PSS signature with the stored public key and rejects replayed nonces.

### Heartbeats

`POST /api/devices/heartbeat`

- Sent every 30-60 seconds
- Updates `last_seen_at`, connectivity, and device status
- Devices are marked offline after 2 minutes without heartbeats

### Uploads

`POST /api/upload/guest`

- Requires signed device authentication
- Validates the device-to-event assignment
- Stores guest captures on SFTP under `/weddings/{eventId}/guests/`

## Main API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/events` | List events |
| POST | `/api/events` | Create event |
| PUT | `/api/events/{id}` | Update event |
| DELETE | `/api/events/{id}` | Delete event and images |
| GET | `/api/devices` | List photobooth devices |
| GET | `/api/devices/{id}` | Device detail |
| PUT | `/api/devices/{id}/assignment` | Assign or unassign event |
| POST | `/api/devices/register` | Register new device |
| GET | `/api/devices/{id}/config` | Fetch signed device config |
| POST | `/api/devices/heartbeat` | Heartbeat from device |
| POST | `/api/upload/guest` | Signed booth image upload |
| POST | `/api/upload/couple/{id}?token=...` | Couple upload |
| GET | `/d/{imageId}` | Guest download page |

## Admin Panel

### Events

- Create, edit, and delete wedding events
- See assigned booth counts per event
- Browse images and slideshow links

### Devices

- Provision devices and generate bootstrap JSON
- Monitor online/offline state and last heartbeat
- Inspect key fingerprints
- Assign or reassign events
- Delete retired or compromised devices so their keys can no longer authenticate

### SMTP

- Configure SMTP from the admin UI
- Test delivery and unlock admin OTP verification

## Photobooth Project Integration

Use the signed client directly:

```bash
dotnet run --project apps/client/Photobooth.Client.csproj -- upload-file --config ./device.json --file ./capture.jpg
```

Or wire the provided shell hook into Photobooth Project:

```bash
PHOTOBOOTH_DEVICE_CONFIG=/path/to/device.json ./scripts/photobooth-device-hook.sh "{filename}"
```

## Device Config File

```json
{
  "serverUrl": "https://photobooth.example.com",
  "deviceId": "11111111-2222-3333-4444-555555555555",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  "watchDirectory": "/opt/photobooth/output",
  "deviceName": "Booth 01"
}
```

## Kubernetes Deployment

### Deploy

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/secrets.yaml
kubectl apply -f infra/k8s/database.yaml
kubectl apply -f infra/k8s/api-deployment.yaml
kubectl apply -f infra/k8s/web-deployment.yaml
kubectl apply -f infra/k8s/cronjob-cleanup.yaml
```

### Required secrets

| Key | Purpose |
|---|---|
| `DB_CONNECTION` | PostgreSQL connection string |
| `DB_PASSWORD` | PostgreSQL password |
| `APP_BASE_URL` | Public base URL used in device config and QR links |
| `JWT_SECRET` | JWT signing secret |
| `JWT_ISSUER` | JWT issuer |
| `JWT_AUDIENCE` | JWT audience |
| `SFTP_HOST` | SFTP host |
| `SFTP_PORT` | SFTP port |
| `SFTP_USERNAME` | SFTP username |
| `SFTP_PASSWORD` | SFTP password |
| `SFTP_BASE_PATH` | Remote storage root |
| `SFTP_PUBLIC_BASE_URL` | Public photo host if applicable |

### Scheduled jobs

The cleanup CronJob:

- deletes expired events and files
- removes expired device nonces
- marks stale devices offline

## Security

- RSA public/private key auth for booth devices
- replay protection with nonce + timestamp
- JWT auth for admins and gallery users
- rate limiting for auth and upload endpoints
- SFTP isolated behind the API
- no direct booth access to storage credentials
- HTTPS-ready Kubernetes ingress setup

## Verification Commands

```bash
dotnet build apps/api/Photobooth.Api.csproj
dotnet build apps/client/Photobooth.Client.csproj
npm --prefix apps/web run build
```
