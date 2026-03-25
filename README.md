# Photobooth Management System

Wedding photobooth management platform with multi-event support, SFTP-based image storage, QR code downloads, and GDPR compliance.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Kubernetes cluster                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  React SPA   │  │ ASP.NET Core │  │   PostgreSQL 16    │ │
│  │  (nginx)     │──│  Web API     │──│                    │ │
│  │  :80         │  │  :8080       │  │  :5432             │ │
│  └──────────────┘  └──────┬───────┘  └────────────────────┘ │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  SFTP Server  │
                    │  /weddings/   │
                    └───────────────┘

External:
  Photobooth Project ──curl POST──▶ /api/upload/guest
```

## Tech Stack

| Layer          | Technology                         |
|----------------|------------------------------------|
| Backend        | ASP.NET Core 8 (C# Web API)       |
| Frontend       | React 18 + Vite + TypeScript       |
| Database       | PostgreSQL 16                      |
| Storage        | SFTP (SSH.NET)                     |
| Deployment     | Kubernetes + Docker                |
| Monorepo       | NX                                 |

## Project Structure

```
├── apps/
│   ├── api/                    # ASP.NET Core Web API
│   │   ├── Configuration/      # SftpSettings, UploadSettings
│   │   ├── Controllers/        # Events, Upload, Download, Images
│   │   ├── Data/               # EF Core DbContext + Migrations
│   │   ├── DTOs/               # Request/Response DTOs
│   │   ├── Jobs/               # GDPR background cleanup
│   │   ├── Middleware/         # File validation (type, size, magic bytes)
│   │   ├── Models/             # Event, Image entities
│   │   ├── Repositories/       # Data access layer
│   │   └── Services/           # Business logic (Event, Image, SFTP, ZIP)
│   └── web/                    # React SPA
│       └── src/
│           ├── components/     # EventForm, EventTable
│           ├── pages/          # AdminDashboard, CoupleUpload, DownloadPage, Slideshow
│           ├── services/       # API client
│           └── types/          # TypeScript interfaces
├── infra/k8s/                  # Kubernetes manifests
├── scripts/                    # Photobooth upload script
├── docker-compose.yaml         # Local development
└── nx.json                     # NX workspace config
```

## Quick Start (Local Development)

### Prerequisites

- .NET 8 SDK
- Node.js 20+
- PostgreSQL 16 (or use Docker Compose)
- `dotnet-ef` tool: `dotnet tool install --global dotnet-ef`

### 1. Start Database

```bash
docker compose up db -d
```

### 2. Run Migrations

```bash
dotnet ef database update --project apps/api/Photobooth.Api.csproj
```

### 3. Start API

```bash
# Terminal 1
ASPNETCORE_ENVIRONMENT=Development dotnet run --project apps/api/Photobooth.Api.csproj
```

The API runs at `http://localhost:5000` with Swagger UI at `/swagger`.
In development mode, files are stored locally (no SFTP server needed).

### 4. Start Frontend

```bash
# Terminal 2
cd apps/web && npm install && npm run dev
```

The frontend runs at `http://localhost:5173` with API proxy configured for `http://localhost:5000` by default.
Set `VITE_API_PROXY_TARGET` if you intentionally run the API on another port.

### 5. (Alternative) Docker Compose

```bash
docker compose up --build
```

- API: `http://localhost:5000`
- Web: `http://localhost:8080`

## API Endpoints

| Method | Endpoint                            | Description                    |
|--------|-------------------------------------|--------------------------------|
| GET    | `/api/events`                       | List all events                |
| GET    | `/api/events/{id}`                  | Get event by ID                |
| POST   | `/api/events`                       | Create event                   |
| PUT    | `/api/events/{id}`                  | Update event                   |
| DELETE | `/api/events/{id}`                  | Delete event + SFTP data       |
| GET    | `/api/events/{id}/images`           | Get all images (slideshow)     |
| POST   | `/api/upload/guest`                 | Upload guest photo (multipart) |
| POST   | `/api/upload/couple/{id}?token=XYZ` | Upload couple photo            |
| GET    | `/api/upload/validate/{id}?token=X` | Validate upload token          |
| GET    | `/api/images/{id}`                  | Get image metadata             |
| GET    | `/api/images/{id}/file`             | Serve image file (from SFTP)   |
| GET    | `/d/{imageId}`                      | Download page data             |
| GET    | `/api/download/{imageId}/zip`       | Stream ZIP (guest + couple)    |
| GET    | `/api/health`                       | Health check endpoint          |

## Photobooth Integration

Configure the provided bash script in Photobooth Project's post-capture command:

```bash
# Set environment variables
export PHOTOBOOTH_API_URL="https://photobooth.example.com"
export PHOTOBOOTH_EVENT_ID="your-event-uuid"

# Test upload
./scripts/photobooth-upload.sh /path/to/test-photo.jpg
```

See [scripts/photobooth-upload.sh](scripts/photobooth-upload.sh) for full documentation.

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl apply -f infra/k8s/namespace.yaml
```

### 2. Configure Secrets

Edit `infra/k8s/secrets.yaml` with real credentials, then:

```bash
kubectl apply -f infra/k8s/secrets.yaml
```

### 3. Deploy

```bash
kubectl apply -f infra/k8s/database.yaml
kubectl apply -f infra/k8s/api-deployment.yaml
kubectl apply -f infra/k8s/web-deployment.yaml
kubectl apply -f infra/k8s/cronjob-cleanup.yaml
```

### Required Secrets

| Key                 | Description                      |
|---------------------|----------------------------------|
| `DB_CONNECTION`     | Full PostgreSQL connection string |
| `DB_PASSWORD`       | PostgreSQL password (for init)   |
| `SFTP_HOST`         | SFTP server hostname             |
| `SFTP_PORT`         | SFTP port (usually 22)           |
| `SFTP_USERNAME`     | SFTP username                    |
| `SFTP_PASSWORD`     | SFTP password                    |
| `SFTP_BASE_PATH`    | Remote base path (e.g. /weddings)|
| `SFTP_PUBLIC_BASE_URL` | Public URL for images         |

## SFTP Storage Layout

```
/weddings/
  {eventId}/
    couple/     # Couple-uploaded portraits
      {uuid}.jpg
    guests/     # Photobooth captures
      {uuid}.jpg
```

## GDPR Compliance

- **EXIF stripping**: All JPEG EXIF/APP1 metadata removed on upload
- **Auto-deletion**: Background job runs every 6 hours; CronJob runs daily at 3 AM
- **Configurable retention**: Per-event (default 90 days after event date)
- **No local file storage**: Images exist only on SFTP
- **Secure tokens**: 256-bit random tokens for couple upload links
- **No directory listing**: Nginx `autoindex off`, no public SFTP listing
- **Manual deletion**: `DELETE /api/events/{id}` removes DB records + SFTP files

## Security Features

- File type validation (magic bytes + extension + content-type)
- 10 MB file size limit (middleware + controller-level)
- Rate limiting (30 uploads/minute per IP, 20 requests/second global)
- Constant-time token comparison (prevents timing attacks)
- Security headers (X-Frame-Options, X-Content-Type-Options, CSP)
- Non-guessable filenames (UUID-based)
- Token validation via server-side endpoint (no client-side token exposure)

## NX Commands

```bash
# API
npx nx run api:build        # Build API
npx nx run api:serve        # Run API
npx nx run api:watch        # Run API with hot-reload

# Frontend
npx nx run web:dev          # Start dev server
npx nx run web:build        # Production build
npx nx run web:preview      # Preview production build
```
