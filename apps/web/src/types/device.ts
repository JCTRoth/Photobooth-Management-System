export interface DeviceAssignedEvent {
  eventId: string;
  eventName: string;
  eventDate: string;
  expiresAt: string;
}

export interface DeviceRuntimeTelemetry {
  clientVersion: string | null;
  runtimeVersion: string | null;
  machineName: string | null;
  localDashboardUrl: string | null;
  watchDirectory: string | null;
  lastConfigSyncAt: string | null;
  lastEventLoadedAt: string | null;
  loadedEventName: string | null;
  lastUploadAt: string | null;
  lastUploadStatus: string | null;
  lastUploadFileName: string | null;
  lastUploadError: string | null;
  lastHeartbeatError: string | null;
  watcherState: string | null;
  pendingUploadCount: number;
}

export interface PhotoboothClientLocalConfig {
  serverUrl: string;
  deviceId: string;
  privateKey: string;
  deviceName?: string;
  watchDirectory?: string | null;
  uploadSettlingDelayMs?: number;
  allowedExtensions?: string[];
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
  runtime: DeviceRuntimeTelemetry | null;
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
  runtime: DeviceRuntimeTelemetry | null;
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
