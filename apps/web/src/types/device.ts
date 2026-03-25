export interface DeviceAssignedEvent {
  eventId: string;
  eventName: string;
  eventDate: string;
  expiresAt: string;
}

export interface DeviceSummary {
  id: string;
  name: string;
  status: string;
  connectivity: 'online' | 'offline' | 'never-seen';
  lastSeenAt: string | null;
  publicKeyFingerprint: string | null;
  createdAt: string;
  assignedEvent: DeviceAssignedEvent | null;
}

export interface DeviceDetail {
  id: string;
  name: string;
  status: string;
  connectivity: 'online' | 'offline' | 'never-seen';
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  publicKeyFingerprint: string;
  assignedEvent: DeviceAssignedEvent | null;
}

export interface DeviceListResponse {
  devices: DeviceSummary[];
  total: number;
}

export interface RegisterDeviceResponse {
  deviceId: string;
  name: string;
  publicKeyPem: string;
  privateKeyPem?: string | null;
  status: string;
  createdAt: string;
}

export interface DeviceConfigResponse {
  deviceId: string;
  heartbeatIntervalSeconds: number;
  heartbeatEndpoint: string;
  guestUploadEndpoint: string;
  configEndpoint: string;
  qrBaseUrl: string;
  assignedEvent: DeviceAssignedEvent | null;
}
