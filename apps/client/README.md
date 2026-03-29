# Photobooth Client

The device client signs every request with the device private key, sends periodic heartbeats, fetches its assigned event, uploads captured images to the central backend, and now serves a booth-local dashboard on `localhost` for setup and live operations.

## Nx Targets

```bash
npx nx run client:build
npx nx run client:run
npx nx run client:register
npx nx run client:upload-file
```

The canned Nx targets are meant for local development. They use `apps/client/photobooth-device.local.json` and will auto-bootstrap it when helpful. For real booth provisioning, prefer the explicit commands below so you can set the correct server URL, config path, and watch directory.

## Commands

```bash
dotnet run --project apps/client/Photobooth.Client.csproj -- register --server-url http://localhost:5000 --device-name "Booth 01" --config ./device.json --watch-dir /photos/out
dotnet run --project apps/client/Photobooth.Client.csproj -- run --config ./device.json
dotnet run --project apps/client/Photobooth.Client.csproj -- dashboard --config ./device.json --port 5077
dotnet run --project apps/client/Photobooth.Client.csproj -- upload-file --config ./device.json --file /photos/out/capture.jpg
```

`dashboard` is the preferred booth-side entry point for real hardware. It starts a localhost web server where the operator can:

- generate an RSA key pair on the booth itself
- register the device with the central server
- import or download the device JSON
- start or stop the booth runtime
- watch the live wedding assignment, heartbeat, watcher state, and latest upload result

For Photobooth Project post-processing, point the hook to:

```bash
PHOTOBOOTH_DEVICE_CONFIG=/path/to/device.json ./scripts/photobooth-device-hook.sh "{filename}"
```

## Device Config Format

```json
{
  "serverUrl": "https://photobooth.example.com",
  "deviceId": "11111111-2222-3333-4444-555555555555",
  "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  "watchDirectory": "/opt/photobooth/output",
  "deviceName": "Booth 01"
}
```

`serverUrl` should point to the public host that exposes `/api`, not directly to the SFTP server.

For the full local workflow, troubleshooting tips, and migration/build commands, see [../../docs/development.md](../../docs/development.md).
