import type {
  EventListResponse,
  EventResponse,
  CreateEventRequest,
  UpdateEventRequest,
  ImageListResponse,
  UploadResponse,
  DownloadPageData,
} from '@/types/api';

const BASE = '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
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
  const res = await fetch(`${BASE}/api/events/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Delete failed: ${res.status}`);
  }
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
