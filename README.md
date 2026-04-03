# Photobooth Management System

Production-ready wedding photobooth platform for managing multiple booth devices, central event assignments, signed guest uploads, QR downloads, and SFTP-backed image storage.

## Screenshots

Screenshots from landing page:

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
│                              ASP.NET Core API                                │
│  JWT admin auth • device signature verification • event management • SFTP    │
│  device registration • heartbeat tracking • signed upload validation         │
└──────────────┬───────────────────────────────┬───────────────────────────────┘
               │                               │
               │ EF Core / Npgsql             │ SSH / SFTP
               ▼                               ▼
      ┌──────────────────┐            ┌──────────────────────┐
      │   PostgreSQL 16  │            │   SFTP image store   │
      │ events/devices/..│            │ /weddings/{eventId}  │
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

| Layer | Technology | Description |
|---|---|---|
| Backend | ASP.NET Core 8, EF Core, Npgsql | REST API with JWT auth, device verification, SFTP integration |
| Admin UI | React 18, TypeScript, Vite | Admin panel for managing devices, events, and uploads |
| Device client | .NET 8 console client | Signed photobooth device client with local dashboard |
| Database | PostgreSQL 16 | Event and device data storage |
| Storage | SFTP | Image storage backend |
| Build System | Nx | Monorepo build and task orchestration |
| Deployment | Kubernetes, Docker | Containerized deployment with K8s manifests |

## Repository Layout

```text
apps/
  api/           ASP.NET Core API, EF migrations, services, controllers
  web/           React admin panel and public pages
  client/        Signed photobooth device client with local dashboard
infra/k8s/       Kubernetes manifests for production deployment
scripts/         Development and deployment scripts
docs/            Architecture and development documentation
static/          Nx workspace static assets
docker-compose.yaml  Local development orchestration
```

## Prerequisites

- **.NET 8 SDK** - For API and client applications
- **Node.js 20+** - For frontend and build tools
- **npm** - Package management
- **Docker & Docker Compose** - For database and containerized development
- **dotnet-ef tool** - For database migrations (`dotnet tool install --global dotnet-ef`)

## Configuration

Each component has its own configuration file:

- **API**: `apps/api/appsettings.json` - Database, SFTP, CORS, upload settings
- **Client**: `apps/client/photobooth-device.local.json` - Server URL, device credentials, watch directory
- **Web**: `apps/web/public/config.json` - API endpoints, app settings

## Documentation

- [Development Guide](./docs/development.md) - Detailed development setup and workflows
- [Client README](./apps/client/README.md) - Device client documentation
- [Zustand Integration](./docs/zustand-integration.md) - State management guide
- [Zustand Quick Reference](./docs/zustand-quick-reference.md) - State management patterns

## Local Development

### Quick Start (Recommended)

To start all components at once:

```bash
./scripts/start-all.sh
```

This will start PostgreSQL, apply migrations, and launch the API and web interface with detailed logging.

### Manual Setup

If you prefer to start components individually:

#### 1. Install Dependencies

```bash
# Frontend dependencies
npm --prefix apps/web install

# .NET tools (if not already installed)
dotnet tool install --global dotnet-ef
```

#### 2. Start PostgreSQL

```bash
docker compose up db -d
```

#### 3. Apply database migrations

```bash
npm run api:db-update
```

#### 4. Start the API with hot reload

```bash
npx nx run api:dev
```

The API listens on `http://localhost:5000`.

#### 5. Start the frontend with hot reload

```bash
npx nx run web:dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` to the API.

#### 6. Start API and frontend together

```bash
npm run dev
```

#### 7. Optional: Include device client

```bash
npm run dev:all  # Starts api, web, and client
```

### Device Client Development

For testing the photobooth device client:

```bash
# Register device (idempotent)
npx nx run client:register

# Run client
npx nx run client:run

# Upload test file
npx nx run client:upload-file
```

See [Client README](./apps/client/README.md) for detailed client documentation.

### Testing

Run the full test stack:

```bash
npm run test:stack
```

This starts all services with test configuration and runs integration tests.

## Deployment

### Docker Compose (Development)

```bash
docker compose up -d
```

Services will be available at:
- API: http://localhost:5000
- Web: http://localhost:8080
- Database: localhost:5433

### Kubernetes (Production)

Deploy to Kubernetes cluster:

```bash
kubectl apply -f infra/k8s/
```

Components use container images from `ghcr.io/JCTRoth/Photobooth-Management-System`.

### Container Registry

Images are published to GitHub Container Registry:
- `ghcr.io/JCTRoth/Photobooth-Management-System/api:latest`
- `ghcr.io/JCTRoth/Photobooth-Management-System/web:latest`

## Available Scripts

### API Scripts
- `npm run api:dev` - Start API with hot reload
- `npm run api:build` - Build API for production
- `npm run api:db-update` - Apply database migrations

### Web Scripts
- `npm run web:dev` - Start frontend with hot reload
- `npm run web:build` - Build frontend for production
- `npm run web:preview` - Preview production build

### Client Scripts
- `npm run client:dev` - Start client with hot reload
- `npm run client:register` - Register device with server
- `npm run client:run` - Run client application

### Development Scripts
- `npm run dev` - Start API and web together
- `npm run dev:all` - Start all components (API, web, client)
- `npm run test:stack` - Run full integration test suite

## Key Features

- **Multi-device Management**: Register and manage multiple photobooth devices
- **Event Assignment**: Assign devices to specific wedding events
- **Secure Uploads**: RSA-signed requests with nonce/timestamp validation
- **SFTP Storage**: Centralized image storage with public URL generation
- **QR Code Downloads**: Generate QR codes for guest photo downloads
- **Admin Dashboard**: React-based admin interface for event management
- **Device Heartbeat**: Real-time device status monitoring
- **Local Device Dashboard**: Web interface on each photobooth device
- **GDPR Compliance**: Automated data cleanup jobs
- **Rate Limiting**: Configurable API rate limits
- **JWT Authentication**: Secure admin authentication

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/refresh` - Token refresh

### Devices
- `GET /api/devices` - List all devices
- `POST /api/devices/register` - Register new device
- `GET /api/devices/{id}` - Get device details
- `PUT /api/devices/{id}` - Update device
- `DELETE /api/devices/{id}` - Remove device

### Events
- `GET /api/events` - List events
- `POST /api/events` - Create event
- `GET /api/events/{id}` - Get event details
- `PUT /api/events/{id}` - Update event
- `DELETE /api/events/{id}` - Delete event

### Images
- `GET /api/images` - List images
- `GET /api/images/{id}` - Get image details
- `GET /api/images/download/{id}` - Download image
- `POST /api/upload` - Upload image (device-signed)

### Health
- `GET /api/health` - Health check endpoint

## Contributing

1. Follow the [Development Guide](./docs/development.md)
2. Use Nx commands for building and testing
3. Ensure all tests pass with `npm run test:stack`
4. Update documentation as needed

## License

See [LICENSE](LICENSE) file for details.
If you prefer one command for both hot-reloading servers, use:

```bash
npm run dev
```

### 5. Bootstrap admin access

On a fresh database the API creates the first admin automatically:

```text
identifier: Admin
password:   Admin
```

The first login forces a password change.

### 6. Provision and run a photobooth client

```bash
npx nx run client:dev
npx nx run client:register
npx nx run client:run
npx nx run client:build
npx nx run client:upload-file
```

You can also use the admin panel at `/admin/devices` to provision a device package and download the JSON config.
The Nx targets use a local dev config at `apps/client/photobooth-device.local.json` and will auto-bootstrap it when needed.
`client:dev` uses `dotnet watch`, so edits to the .NET client reload automatically during local development.
If the API is not running yet, the helper scripts now stop early with a clear message instead of failing with a bare connection-refused error.
For custom parameters, use the raw `dotnet run --project apps/client/Photobooth.Client.csproj -- ...` commands from [apps/client/README.md](./apps/client/README.md).

For real booth setup, prefer the booth-local dashboard:

```bash
dotnet run --project apps/client/Photobooth.Client.csproj -- dashboard --config ./device.json --port 5077
```

That starts a localhost control page on the booth machine where the operator can generate the key locally, register the device, save or import the JSON config, start the runtime, and inspect live status. The central admin UI remains the server-side control plane for assignments and fleet monitoring.

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
- Enable admin password reset emails and the `/admin/reset-password` recovery flow

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
