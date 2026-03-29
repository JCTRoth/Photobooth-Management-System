import { useCallback, useEffect, useState } from 'react';
import { assignDeviceEvent, deleteDevice, getDevices, getEvents, registerDevice } from '@/services/api';
import { DeviceTable } from '@/components/DeviceTable';
import type { EventResponse } from '@/types/api';
import type { DeviceSummary, RegisterDeviceResponse } from '@/types/device';

interface ProvisioningState {
  registration: RegisterDeviceResponse;
  serverUrl: string;
}

function buildDeviceConfig(result: ProvisioningState) {
  return JSON.stringify(
    {
      serverUrl: result.serverUrl,
      deviceId: result.registration.deviceId,
      privateKey: result.registration.privateKeyPem ?? '<provide-the-matching-private-key>',
      watchDirectory: '/opt/photobooth/output',
      deviceName: result.registration.name,
    },
    null,
    2
  );
}

export function AdminDevicesDashboard() {
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningDeviceId, setAssigningDeviceId] = useState<string | null>(null);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionName, setProvisionName] = useState('');
  const [provisionServerUrl, setProvisionServerUrl] = useState(() => window.location.origin);
  const [provisionPublicKeyPem, setProvisionPublicKeyPem] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [provisionedDevice, setProvisionedDevice] = useState<ProvisioningState | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'config' | 'private-key'>('idle');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [deviceData, eventData] = await Promise.all([getDevices(), getEvents()]);
      setDevices(deviceData.devices);
      setEvents(eventData.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = useCallback(
    async (deviceId: string, eventId: string | null) => {
      try {
        setAssigningDeviceId(deviceId);
        setError(null);
        await assignDeviceEvent(deviceId, eventId);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to assign event');
      } finally {
        setAssigningDeviceId(null);
      }
    },
    [loadData]
  );

  const handleProvision = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        setProvisioning(true);
        setError(null);

        const registration = await registerDevice(
          provisionName.trim(),
          provisionPublicKeyPem.trim() || undefined
        );

        setProvisionedDevice({
          registration,
          serverUrl: provisionServerUrl.trim().replace(/\/$/, ''),
        });
        setShowProvisionModal(false);
        setProvisionName('');
        setProvisionPublicKeyPem('');
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to provision device');
      } finally {
        setProvisioning(false);
      }
    },
    [loadData, provisionName, provisionPublicKeyPem, provisionServerUrl]
  );

  const handleDelete = useCallback(
    async (device: DeviceSummary) => {
      const assignmentLabel = device.assignedEvent ? ` assigned to "${device.assignedEvent.eventName}"` : '';
      const connectivityLabel = device.connectivity === 'online' ? ' It is currently online.' : '';

      if (
        !window.confirm(
          `Delete device "${device.name}"?${assignmentLabel}${connectivityLabel} This removes its registered public key and blocks further uploads until it is provisioned again.`
        )
      ) {
        return;
      }

      try {
        setDeletingDeviceId(device.id);
        setError(null);
        await deleteDevice(device.id);

        if (provisionedDevice?.registration.deviceId === device.id) {
          setProvisionedDevice(null);
        }

        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete device');
      } finally {
        setDeletingDeviceId(null);
      }
    },
    [loadData, provisionedDevice]
  );

  const handleDownloadConfig = useCallback(() => {
    if (!provisionedDevice) return;

    const blob = new Blob([buildDeviceConfig(provisionedDevice)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${provisionedDevice.registration.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-device.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [provisionedDevice]);

  const handleCopyConfig = useCallback(async () => {
    if (!provisionedDevice) return;
    await navigator.clipboard.writeText(buildDeviceConfig(provisionedDevice));
    setCopyState('config');
    window.setTimeout(() => setCopyState('idle'), 1800);
  }, [provisionedDevice]);

  const handleCopyPrivateKey = useCallback(async () => {
    if (!provisionedDevice?.registration.privateKeyPem) return;
    await navigator.clipboard.writeText(provisionedDevice.registration.privateKeyPem);
    setCopyState('private-key');
    window.setTimeout(() => setCopyState('idle'), 1800);
  }, [provisionedDevice]);

  const onlineCount = devices.filter((device) => device.connectivity === 'online').length;
  const assignedCount = devices.filter((device) => device.assignedEvent).length;
  const pendingCount = devices.filter((device) => device.status.toLowerCase() === 'pending').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Photobooth Devices</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            Provision booths, monitor heartbeats, and keep each wedding assigned to the right hardware.
          </p>
          <p className="subtle-note" style={{ marginTop: 10 }}>
            Best practice: start the booth-side localhost dashboard on the device, generate the key there, let the
            booth register itself, and then assign the wedding here in the admin portal.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowProvisionModal(true)}>
          + Provision Device
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button className="btn-secondary" onClick={() => setError(null)} style={{ marginTop: 8 }}>
            Dismiss
          </button>
        </div>
      )}

      <div className="admin-stat-grid">
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Total Devices</span>
          <strong>{devices.length}</strong>
          <p>Provisioned photobooth clients registered with the central backend.</p>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Online Now</span>
          <strong>{onlineCount}</strong>
          <p>Devices that sent a heartbeat within the last two minutes.</p>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Assigned</span>
          <strong>{assignedCount}</strong>
          <p>Booths already linked to a wedding and able to upload guest captures.</p>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Pending First Check-In</span>
          <strong>{pendingCount}</strong>
          <p>Provisioned devices that still need their first authenticated heartbeat.</p>
        </div>
      </div>

      {provisionedDevice && (
        <div className="card device-provision-result">
          <div className="section-header">
            <div>
              <h2 style={{ marginBottom: 4 }}>Bootstrap Package Ready</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                The private key is only shown once. Store it on the photobooth client immediately.
              </p>
            </div>
            <div className="device-provision-actions">
              <button className="btn-secondary" onClick={handleCopyConfig}>
                {copyState === 'config' ? 'Copied config' : 'Copy config'}
              </button>
              {provisionedDevice.registration.privateKeyPem && (
                <button className="btn-secondary" onClick={handleCopyPrivateKey}>
                  {copyState === 'private-key' ? 'Copied key' : 'Copy private key'}
                </button>
              )}
              <button className="btn-primary" onClick={handleDownloadConfig}>
                Download JSON
              </button>
            </div>
          </div>

          <div className="device-provision-grid">
            <div>
              <div className="detail-list">
                <div>
                  <span>Device ID</span>
                  <code>{provisionedDevice.registration.deviceId}</code>
                </div>
                <div>
                  <span>Device Name</span>
                  <strong>{provisionedDevice.registration.name}</strong>
                </div>
                <div>
                  <span>Server URL</span>
                  <code>{provisionedDevice.serverUrl}</code>
                </div>
              </div>

              {!provisionedDevice.registration.privateKeyPem && (
                <p className="subtle-note" style={{ marginTop: 16 }}>
                  A custom public key was supplied, so the matching private key stays on the device side and is not
                  returned here.
                </p>
              )}
            </div>

            <div>
              <div className="code-panel">
                <div className="code-panel-label">photobooth-device.json</div>
                <pre>{buildDeviceConfig(provisionedDevice)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading devices...</p>
      ) : devices.length === 0 ? (
        <div className="card empty-state-panel">
          <h2>No photobooth clients yet</h2>
          <p>
            Provision the first device to generate its identifier and key material, then place the downloaded config
            file on the booth computer.
          </p>
        </div>
      ) : (
        <DeviceTable
          devices={devices}
          events={events}
          assigningDeviceId={assigningDeviceId}
          deletingDeviceId={deletingDeviceId}
          onAssign={handleAssign}
          onDelete={handleDelete}
        />
      )}

      {showProvisionModal && (
        <div className="modal-overlay" onClick={() => !provisioning && setShowProvisionModal(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Provision Photobooth Device</h2>
            <form onSubmit={handleProvision}>
              <div className="form-group">
                <label htmlFor="device-name">Device name</label>
                <input
                  id="device-name"
                  type="text"
                  value={provisionName}
                  onChange={(e) => setProvisionName(e.target.value)}
                  placeholder="e.g. Booth Van 01"
                  maxLength={150}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="device-server-url">Server URL</label>
                <input
                  id="device-server-url"
                  type="url"
                  value={provisionServerUrl}
                  onChange={(e) => setProvisionServerUrl(e.target.value)}
                  placeholder="https://photobooth.example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="device-public-key">Public key PEM (optional advanced mode)</label>
                <textarea
                  id="device-public-key"
                  value={provisionPublicKeyPem}
                  onChange={(e) => setProvisionPublicKeyPem(e.target.value)}
                  placeholder="Leave empty to let the backend generate a fresh RSA keypair."
                  rows={8}
                />
              </div>

              <p className="subtle-note">
                If you leave the public key empty, the backend creates a keypair and returns the private key once so you
                can place it on the photobooth device.
              </p>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowProvisionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={provisioning}>
                  {provisioning ? 'Provisioning...' : 'Generate Device Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
