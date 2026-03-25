export type SlideshowAlbumSource = 'all' | 'guest' | 'couple';
export type SlideshowAlbumMode = 'cinema' | 'mosaic' | 'spotlight';

export interface SlideshowAlbum {
  slug: string;
  name: string;
  source: SlideshowAlbumSource;
  mode: SlideshowAlbumMode;
}

export interface SlideshowAlbumInput {
  name: string;
  source: SlideshowAlbumSource;
  mode: SlideshowAlbumMode;
}

export interface EventResponse {
  id: string;
  name: string;
  date: string;
  uploadToken: string;
  expiresAt: string;
  createdAt: string;
  coupleUploadUrl: string;
  imageCount: number;
  slideshowAlbums: SlideshowAlbum[];
}

export interface EventListResponse {
  events: EventResponse[];
  total: number;
}

export interface CreateEventRequest {
  name: string;
  date: string;
  retentionDays?: number;
  slideshowAlbums?: SlideshowAlbumInput[];
}

export interface UpdateEventRequest {
  name: string;
  date: string;
  retentionDays?: number;
  slideshowAlbums?: SlideshowAlbumInput[];
}

export interface ImageResponse {
  id: string;
  eventId: string;
  filename: string;
  type: 'Guest' | 'Couple';
  caption?: string | null;
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
