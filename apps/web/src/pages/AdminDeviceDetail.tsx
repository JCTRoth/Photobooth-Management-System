import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { assignDeviceEvent, getDevice, getDeviceConfig, getEvents } from '@/services/api';
import type { EventResponse } from '@/types/api';
import type { DeviceConfigResponse, DeviceDetail } from '@/types/device';

function formatDateTime(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export function AdminDeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [config, setConfig] = useState<DeviceConfigResponse | null>(null);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!deviceId) return;

    try {
      setLoading(true);
      setError(null);

      const [deviceResponse, configResponse, eventData] = await Promise.all([
        getDevice(deviceId),
        getDeviceConfig(deviceId),
        getEvents(),
      ]);

      setDevice(deviceResponse);
      setConfig(configResponse);
      setEvents(eventData.events);
      setSelectedEventId(deviceResponse.assignedEvent?.eventId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load device');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveAssignment = useCallback(async () => {
    if (!deviceId) return;

    try {
      setSaving(true);
      setError(null);
      await assignDeviceEvent(deviceId, selectedEventId || null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update device assignment');
    } finally {
      setSaving(false);
    }
  }, [deviceId, loadData, selectedEventId]);

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', padding: 20 }}>Loading device details...</p>;
  }

  if (error || !device || !config) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger)' }}>Device not available</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>{error}</p>
        <Link to="/admin/devices" style={{ marginTop: 16, display: 'inline-block' }}>
          Back to Devices
        </Link>
      </div>
    );
  }

  const serverUrl = new URL(config.configEndpoint).origin;
  const assignmentChanged = selectedEventId !== (device.assignedEvent?.eventId ?? '');
  const bootstrapTemplate = JSON.stringify(
    {
      serverUrl,
      deviceId: config.deviceId,
      privateKey: '<paste-private-key-from-provisioning>',
      watchDirectory: '/opt/photobooth/output',
      deviceName: device.name,
    },
    null,
    2
  );

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/admin/devices" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Back to Devices
          </Link>
          <h1 style={{ marginTop: 4 }}>{device.name}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            Device identity, signed client configuration, and assignment controls for this booth.
          </p>
        </div>
        <div className="detail-chip-stack">
          <span className={`status-pill connectivity-${device.connectivity}`}>{device.connectivity}</span>
          <span className={`status-pill status-${device.status.toLowerCase()}`}>{device.status}</span>
        </div>
      </div>

      <div className="detail-grid detail-grid-compact">
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Last Heartbeat</span>
          <strong>{formatDateTime(device.lastSeenAt)}</strong>
          <p>Devices are marked offline when they stop checking in for more than two minutes.</p>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Registered</span>
          <strong>{new Date(device.createdAt).toLocaleDateString()}</strong>
          <p>The initial provisioning timestamp stored in PostgreSQL.</p>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Updated</span>
          <strong>{formatDateTime(device.updatedAt)}</strong>
          <p>Any assignment change or device heartbeat refreshes this state.</p>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Key Fingerprint</span>
          <strong>{device.publicKeyFingerprint}</strong>
          <p>Short SHA-256 fingerprint for quick verification during setup.</p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="section-header">
            <div>
              <h2 style={{ marginBottom: 4 }}>Event Assignment</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                Guest uploads are accepted only for the event assigned to this device.
              </p>
            </div>
          </div>

          <div className="detail-list">
            <div>
              <span>Current event</span>
              <strong>{device.assignedEvent?.eventName ?? 'Unassigned'}</strong>
            </div>
            <div>
              <span>Event date</span>
              <strong>{device.assignedEvent?.eventDate ?? 'n/a'}</strong>
            </div>
            <div>
              <span>Retention until</span>
              <strong>{device.assignedEvent ? new Date(device.assignedEvent.expiresAt).toLocaleDateString() : 'n/a'}</strong>
            </div>
          </div>

          <div className="table-inline-form detail-assignment-form">
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
              <option value="">Unassigned</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary table-inline-button"
              onClick={handleSaveAssignment}
              disabled={!assignmentChanged || saving}
            >
              {saving ? 'Saving...' : 'Save Assignment'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <div>
              <h2 style={{ marginBottom: 4 }}>Client Configuration</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                The device signs every request with its private key and uses these backend endpoints.
              </p>
            </div>
          </div>

          <div className="detail-list">
            <div>
              <span>Server URL</span>
              <code>{serverUrl}</code>
            </div>
            <div>
              <span>Heartbeat endpoint</span>
              <code>{config.heartbeatEndpoint}</code>
            </div>
            <div>
              <span>Upload endpoint</span>
              <code>{config.guestUploadEndpoint}</code>
            </div>
            <div>
              <span>QR base URL</span>
              <code>{config.qrBaseUrl}</code>
            </div>
            <div>
              <span>Heartbeat interval</span>
              <strong>{config.heartbeatIntervalSeconds} seconds</strong>
            </div>
          </div>

          <div className="code-panel" style={{ marginTop: 20 }}>
            <div className="code-panel-label">Device JSON template</div>
            <pre>{bootstrapTemplate}</pre>
          </div>

          <p className="subtle-note" style={{ marginTop: 16 }}>
            The private key is intentionally not retrievable after provisioning. Re-provision the device if the private
            key is lost.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Photobooth Hook</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Use the dedicated client app or shell wrapper as the post-capture hook in Photobooth Project.
            </p>
          </div>
        </div>

        <div className="code-panel">
          <div className="code-panel-label">Example command</div>
          <pre>{`PHOTOBOOTH_DEVICE_CONFIG=/etc/photobooth/device.json ./scripts/photobooth-device-hook.sh "/path/to/photo.jpg"`}</pre>
        </div>
      </div>
    </>
  );
}
