import type { DeviceConfigResponse, PhotoboothClientLocalConfig } from '@/types/device';

export interface BoothHealthStatus {
  status: string;
  reason?: string;
  latencyMs: number;
}

const encoder = new TextEncoder();

export function parseLocalDeviceConfig(raw: string): PhotoboothClientLocalConfig {
  const parsed = JSON.parse(raw) as Partial<PhotoboothClientLocalConfig>;

  if (
    typeof parsed.serverUrl !== 'string' ||
    typeof parsed.deviceId !== 'string' ||
    typeof parsed.privateKey !== 'string' ||
    !parsed.serverUrl.trim() ||
    !parsed.deviceId.trim() ||
    !parsed.privateKey.trim()
  ) {
    throw new Error('The device JSON must include serverUrl, deviceId, and privateKey.');
  }

  return {
    serverUrl: parsed.serverUrl.trim().replace(/\/$/, ''),
    deviceId: parsed.deviceId.trim(),
    privateKey: parsed.privateKey.trim(),
    deviceName: parsed.deviceName?.trim() || undefined,
    watchDirectory: parsed.watchDirectory?.trim() || null,
    uploadSettlingDelayMs: parsed.uploadSettlingDelayMs,
    allowedExtensions: parsed.allowedExtensions ?? ['.jpg', '.jpeg', '.png'],
  };
}

export async function fetchBoothHealth(config: PhotoboothClientLocalConfig): Promise<BoothHealthStatus> {
  const startedAt = performance.now();
  const response = await fetch(resolveServerUrl(config.serverUrl, 'api/health'));
  const payload = (await response.json().catch(() => null)) as { status?: string; reason?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.reason ?? `Health check failed with HTTP ${response.status}.`);
  }

  return {
    status: payload?.status ?? 'unknown',
    reason: payload?.reason,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}

export async function fetchSignedDeviceConfig(config: PhotoboothClientLocalConfig): Promise<{
  config: DeviceConfigResponse;
  latencyMs: number;
}> {
  const startedAt = performance.now();
  const response = await sendSignedRequest<DeviceConfigResponse>(
    config,
    'GET',
    `api/devices/${config.deviceId}/config`
  );

  return {
    config: response,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}

async function sendSignedRequest<T>(
  config: PhotoboothClientLocalConfig,
  method: 'GET' | 'POST',
  relativePath: string
): Promise<T> {
  const url = new URL(relativePath, ensureTrailingSlash(config.serverUrl));
  const bodyBytes = new Uint8Array();
  const timestamp = new Date().toISOString();
  const nonce = createNonce();
  const bodyHash = await sha256Hex(bodyBytes);
  // Mirror the .NET client's canonical signature input so booth pages can authenticate without a server helper.
  const canonical = [
    method.toUpperCase(),
    `${url.pathname}${url.search}`,
    timestamp,
    nonce,
    bodyHash,
  ].join('\n');

  const privateKey = await importPrivateKey(config.privateKey);
  const signature = await crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    privateKey,
    encoder.encode(canonical)
  );

  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'X-Photobooth-Device-Id': config.deviceId,
      'X-Photobooth-Timestamp': timestamp,
      'X-Photobooth-Nonce': nonce,
      'X-Photobooth-Signature': arrayBufferToBase64(signature),
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

async function importPrivateKey(privateKeyPem: string) {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function resolveServerUrl(serverUrl: string, relativePath: string) {
  return new URL(relativePath, ensureTrailingSlash(serverUrl)).toString();
}

function ensureTrailingSlash(value: string) {
  return value.trim().endsWith('/') ? value.trim() : `${value.trim()}/`;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function sha256Hex(bytes: Uint8Array) {
  const safeBytes = Uint8Array.from(bytes);
  const hash = await crypto.subtle.digest('SHA-256', safeBytes.buffer);
  return Array.from(new Uint8Array(hash))
    .map((value) => value.toString(16).padStart(2, '0').toUpperCase())
    .join('');
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary);
}

function createNonce() {
  return crypto.randomUUID().replace(/-/g, '');
}

async function readErrorMessage(response: Response) {
  const raw = await response.text();

  if (!raw.trim()) {
    return `Request failed with HTTP ${response.status}.`;
  }

  try {
    const payload = JSON.parse(raw) as { error?: string; message?: string; title?: string };
    return payload.error ?? payload.message ?? payload.title ?? `Request failed with HTTP ${response.status}.`;
  } catch {
    return raw;
  }
}
