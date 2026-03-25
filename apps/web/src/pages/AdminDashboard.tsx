import { useState, useEffect, useCallback } from 'react';
import type { EventResponse, SlideshowAlbumInput } from '@/types/api';
import type { DeviceSummary } from '@/types/device';
import { getEvents, createEvent, updateEvent, deleteEvent, getDevices } from '@/services/api';
import { EventForm } from '@/components/EventForm';
import { EventTable } from '@/components/EventTable';

export function AdminDashboard() {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [eventData, deviceData] = await Promise.all([getEvents(), getDevices()]);
      setEvents(eventData.events);
      setDevices(deviceData.devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleCreate = async (data: {
    name: string;
    date: string;
    retentionDays: number;
    slideshowAlbums: SlideshowAlbumInput[];
  }) => {
    try {
      await createEvent(data);
      setShowForm(false);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    }
  };

  const handleUpdate = async (data: {
    name: string;
    date: string;
    retentionDays: number;
    slideshowAlbums: SlideshowAlbumInput[];
  }) => {
    if (!editingEvent) return;
    try {
      await updateEvent(editingEvent.id, data);
      setEditingEvent(null);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event? This will permanently remove all associated images.')) {
      return;
    }
    try {
      await deleteEvent(id);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  const assignedDeviceCounts = devices.reduce<Record<string, number>>((counts, device) => {
    const eventId = device.assignedEvent?.eventId;
    if (eventId) counts[eventId] = (counts[eventId] ?? 0) + 1;
    return counts;
  }, {});

  const totalPhotos = events.reduce((sum, event) => sum + event.imageCount, 0);
  const onlineDevices = devices.filter((device) => device.connectivity === 'online').length;
  const assignedDevices = devices.filter((device) => device.assignedEvent).length;

  return (
    <>
      <div className="page-header">
        <h1>Wedding Events</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + New Event
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
          <span className="admin-stat-label">Active Events</span>
          <strong>{events.length}</strong>
          <p>All wedding galleries currently managed in the system.</p>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Devices Online</span>
          <strong>{onlineDevices}</strong>
          <p>Photobooths that have checked in during the last two minutes.</p>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Assigned Booths</span>
          <strong>{assignedDevices}</strong>
          <p>Devices already linked to an event and ready for guest uploads.</p>
        </div>
        <div className="card admin-stat-card">
          <span className="admin-stat-label">Photos Stored</span>
          <strong>{totalPhotos}</strong>
          <p>Total guest and couple uploads across all events.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading events...</p>
      ) : events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            No events yet. Create your first wedding event!
          </p>
        </div>
      ) : (
        <EventTable
          events={events}
          assignedDeviceCounts={assignedDeviceCounts}
          onEdit={setEditingEvent}
          onDelete={handleDelete}
        />
      )}

      {showForm && (
        <EventForm
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {editingEvent && (
        <EventForm
          event={editingEvent}
          onSubmit={handleUpdate}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </>
  );
}
