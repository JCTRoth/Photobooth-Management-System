import type {
  EventListResponse,
  EventResponse,
  CreateEventRequest,
  UpdateEventRequest,
  ImageListResponse,
  UploadResponse,
  DownloadPageData,
} from '@/types/api';
import type {
  DeviceConfigResponse,
  DeviceDetail,
  DeviceListResponse,
  RegisterDeviceResponse,
} from '@/types/device';
import type {
  AdminLoginResponse,
  AdminVerifyResponse,
  MarriageEmailStatus,
  MarriageVerifyResponse,
} from '@/types/auth';

const BASE = '';

let _getToken: (() => string | null) | null = null;
let _refreshToken: (() => Promise<string | null>) | null = null;

export function configureAuth(
  getToken: () => string | null,
  refreshToken: () => Promise<string | null>
) {
  _getToken = getToken;
  _refreshToken = refreshToken;
}

async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
  const token = _getToken?.();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${BASE}${url}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && _refreshToken) {
    const newToken = await _refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${BASE}${url}`, { ...options, headers, credentials: 'include' });
    }
  }

  return res;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  const res = await fetchWithAuth(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Events ---

export async function getEvents(): Promise<EventListResponse> {
  return request('/api/events');
}

export async function getEvent(id: string): Promise<EventResponse> {
  return request(`/api/events/${id}`);
}

export async function createEvent(data: CreateEventRequest): Promise<EventResponse> {
  return request('/api/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEvent(id: string, data: UpdateEventRequest): Promise<EventResponse> {
  return request(`/api/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/events/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Delete failed: ${res.status}`);
  }
}

// --- Devices ---

export async function getDevices(): Promise<DeviceListResponse> {
  return request('/api/devices');
}

export async function getDevice(id: string): Promise<DeviceDetail> {
  return request(`/api/devices/${id}`);
}

export async function assignDeviceEvent(id: string, eventId: string | null): Promise<DeviceDetail> {
  return request(`/api/devices/${id}/assignment`, {
    method: 'PUT',
    body: JSON.stringify({ eventId }),
  });
}

export async function deleteDevice(id: string): Promise<void> {
  const res = await fetchWithAuth(`/api/devices/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Delete failed: ${res.status}`);
  }
}

export async function registerDevice(
  name: string,
  publicKeyPem?: string
): Promise<RegisterDeviceResponse> {
  return request('/api/devices/register', {
    method: 'POST',
    body: JSON.stringify({ name, publicKeyPem }),
  });
}

export async function getDeviceConfig(id: string): Promise<DeviceConfigResponse> {
  return request(`/api/devices/${id}/config`);
}

// --- Images ---

export async function getEventImages(eventId: string): Promise<ImageListResponse> {
  return request(`/api/events/${eventId}/images`);
}

export async function uploadGuestImage(eventId: string, file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('eventId', eventId);
  formData.append('file', file);

  const res = await fetch(`${BASE}/api/upload/guest`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Upload failed');
  }
  return res.json();
}

export async function uploadCoupleImage(
  eventId: string,
  token: string,
  file: File
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(
    `${BASE}/api/upload/couple/${eventId}?token=${encodeURIComponent(token)}`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Upload failed');
  }
  return res.json();
}

// --- Download ---

export async function getDownloadPageData(imageId: string): Promise<DownloadPageData> {
  return request(`/d/${imageId}`);
}

// --- Token Validation ---

export async function validateUploadToken(
  eventId: string,
  token: string
): Promise<{ eventId: string; name: string; date: string }> {
  return request(`/api/upload/validate/${eventId}?token=${encodeURIComponent(token)}`);
}

export function getImageFileUrl(imageId: string): string {
  return `${BASE}/api/images/${imageId}/file`;
}

export function getZipDownloadUrl(imageId: string): string {
  return `${BASE}/api/download/${imageId}/zip`;
}

// --- Auth ---

export async function adminLogin(identifier: string, password: string): Promise<AdminLoginResponse> {
  const res = await fetch(`${BASE}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Login failed');
  }
  return res.json();
}

export async function adminVerify(identifier: string, code: string): Promise<AdminVerifyResponse> {
  const res = await fetch(`${BASE}/api/auth/admin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, code }),
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Invalid code');
  }
  return res.json();
}

export async function marriageRequestCode(email: string): Promise<void> {
  const res = await fetch(`${BASE}/api/auth/marriage/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }
}

export async function marriageVerify(email: string, code: string): Promise<MarriageVerifyResponse> {
  const res = await fetch(`${BASE}/api/auth/marriage/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Invalid code');
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function changeAdminPassword(currentPassword: string, newPassword: string, email?: string): Promise<void> {
  return request('/api/auth/admin/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, email }),
  });
}

export interface SmtpSettingsResponse {
  host: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
  useSsl: boolean;
  useStartTls: boolean;
  isVerified: boolean;
  verifiedAt: string | null;
}

export interface SaveSmtpSettingsPayload {
  host: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
  fromName: string;
  useSsl: boolean;
  useStartTls: boolean;
}

export async function getSmtpSettings(): Promise<SmtpSettingsResponse> {
  return request('/api/admin/settings/smtp');
}

export async function saveSmtpSettings(payload: SaveSmtpSettingsPayload): Promise<SmtpSettingsResponse> {
  return request('/api/admin/settings/smtp', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function testSmtpSettings(recipientEmail: string): Promise<{ message: string; otpReady: boolean }> {
  return request('/api/admin/settings/smtp/test', {
    method: 'POST',
    body: JSON.stringify({ recipientEmail }),
  });
}

// --- Marriage Invites (admin) ---

export async function getMarriageInvites(eventId: string): Promise<MarriageEmailStatus[]> {
  return request(`/api/events/${eventId}/invites`);
}

export async function addMarriageInvites(eventId: string, emails: string[]): Promise<MarriageEmailStatus[]> {
  return request(`/api/events/${eventId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ emails }),
  });
}

export async function resendMarriageInvite(eventId: string, inviteId: string): Promise<void> {
  return request(`/api/events/${eventId}/invites/${inviteId}/resend`, { method: 'POST' });
}

export async function removeMarriageInvite(eventId: string, inviteId: string): Promise<void> {
  const token = _getToken?.();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/events/${eventId}/invites/${inviteId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  if (!res.ok && res.status !== 204) throw new Error('Delete failed');
}

// --- Image mutations ---

export async function deleteImage(imageId: string): Promise<void> {
  const token = _getToken?.();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/images/${imageId}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  if (!res.ok && res.status !== 204) throw new Error('Delete failed');
}

export async function updateImageCaption(imageId: string, caption: string | null): Promise<void> {
  return request(`/api/images/${imageId}/caption`, {
    method: 'PATCH',
    body: JSON.stringify({ caption }),
  });
}
