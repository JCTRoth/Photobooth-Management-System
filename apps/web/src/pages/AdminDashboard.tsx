import { useState, useEffect, useCallback } from 'react';
import type { EventResponse } from '@/types/api';
import { getEvents, createEvent, updateEvent, deleteEvent } from '@/services/api';
import { EventForm } from '@/components/EventForm';
import { EventTable } from '@/components/EventTable';

export function AdminDashboard() {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEvents();
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleCreate = async (data: { name: string; date: string; retentionDays: number }) => {
    try {
      await createEvent(data);
      setShowForm(false);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    }
  };

  const handleUpdate = async (data: { name: string; date: string; retentionDays: number }) => {
    if (!editingEvent) return;
    try {
      await updateEvent(editingEvent.id, data);
      setEditingEvent(null);
      await loadEvents();
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
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

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
