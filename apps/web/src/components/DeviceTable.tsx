import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventResponse } from '@/types/api';
import type { DeviceSummary } from '@/types/device';

interface DeviceTableProps {
  devices: DeviceSummary[];
  events: EventResponse[];
  assigningDeviceId: string | null;
  deletingDeviceId: string | null;
  onAssign: (deviceId: string, eventId: string | null) => Promise<void>;
  onDelete: (device: DeviceSummary) => Promise<void>;
}

function formatLastSeen(lastSeenAt: string | null) {
  if (!lastSeenAt) return 'Never';

  const seenAt = new Date(lastSeenAt);
  const deltaMs = Date.now() - seenAt.getTime();
  const deltaMinutes = Math.round(deltaMs / 60000);

  if (deltaMinutes < 1) return 'Just now';
  if (deltaMinutes < 60) return `${deltaMinutes} min ago`;

  return seenAt.toLocaleString();
}

function buildDeviceSubtitle(device: DeviceSummary) {
  const parts = [new Date(device.createdAt).toLocaleDateString()];

  if (device.runtime?.clientVersion) {
    parts.push(`Client ${device.runtime.clientVersion}`);
  }

  if (device.runtime?.loadedEventName) {
    parts.push(`Loaded ${device.runtime.loadedEventName}`);
  }

  return parts.join(' · ');
}

export function DeviceTable({
  devices,
  events,
  assigningDeviceId,
  deletingDeviceId,
  onAssign,
  onDelete,
}: DeviceTableProps) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table className="event-table device-table">
        <thead>
          <tr>
            <th>Device</th>
            <th>Connectivity</th>
            <th>Status</th>
            <th>Last Heartbeat</th>
            <th>Assigned Event</th>
            <th>Fingerprint</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              events={events}
              assigningDeviceId={assigningDeviceId}
              deletingDeviceId={deletingDeviceId}
              onAssign={onAssign}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceRow({
  device,
  events,
  assigningDeviceId,
  deletingDeviceId,
  onAssign,
  onDelete,
}: {
  device: DeviceSummary;
  events: EventResponse[];
  assigningDeviceId: string | null;
  deletingDeviceId: string | null;
  onAssign: (deviceId: string, eventId: string | null) => Promise<void>;
  onDelete: (device: DeviceSummary) => Promise<void>;
}) {
  const [selectedEventId, setSelectedEventId] = useState(device.assignedEvent?.eventId ?? '');

  useEffect(() => {
    setSelectedEventId(device.assignedEvent?.eventId ?? '');
  }, [device.assignedEvent?.eventId]);

  const isSaving = assigningDeviceId === device.id;
  const isDeleting = deletingDeviceId === device.id;
  const hasChanged = selectedEventId !== (device.assignedEvent?.eventId ?? '');

  return (
    <tr>
      <td>
        <div className="table-primary">
          <Link to={`/admin/devices/${device.id}`}>{device.name}</Link>
          <span>{buildDeviceSubtitle(device)}</span>
        </div>
      </td>
      <td>
        <span className={`status-pill connectivity-${device.connectivity}`}>{device.connectivity}</span>
      </td>
      <td>
        <span className={`status-pill status-${device.status.toLowerCase()}`}>{device.status}</span>
      </td>
      <td>{formatLastSeen(device.lastSeenAt)}</td>
      <td>
        <div className="table-inline-form">
          <select
            aria-label={`Assign event for ${device.name}`}
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          <button
            className="btn-secondary table-inline-button"
            type="button"
            onClick={() => onAssign(device.id, selectedEventId || null)}
            disabled={!hasChanged || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </td>
      <td>
        <code>{device.publicKeyFingerprint ?? 'n/a'}</code>
      </td>
      <td>
        <div className="device-action-group">
          <Link to={`/admin/devices/${device.id}`} className="copy-btn">
            Open
          </Link>
          <button
            type="button"
            className="btn-danger table-inline-button"
            onClick={() => onDelete(device)}
            disabled={isDeleting || isSaving}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}
