export interface EventResponse {
  id: string;
  name: string;
  date: string;
  uploadToken: string;
  expiresAt: string;
  createdAt: string;
  coupleUploadUrl: string;
  imageCount: number;
}

export interface EventListResponse {
  events: EventResponse[];
  total: number;
}

export interface CreateEventRequest {
  name: string;
  date: string;
  retentionDays?: number;
}

export interface UpdateEventRequest {
  name: string;
  date: string;
  retentionDays?: number;
}

export interface ImageResponse {
  id: string;
  eventId: string;
  filename: string;
  type: 'Guest' | 'Couple';
  createdAt: string;
  url: string;
  downloadUrl: string;
}

export interface ImageListResponse {
  images: ImageResponse[];
  total: number;
}

export interface UploadResponse {
  imageId: string;
  filename: string;
  downloadUrl: string;
}

export interface DownloadPageData {
  id: string;
  filename: string;
  type: string;
  imageUrl: string;
  zipUrl: string;
}
