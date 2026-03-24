import { useState, useCallback } from 'react';
import type { EventResponse } from '@/types/api';

interface EventFormProps {
  event?: EventResponse;
  onSubmit: (data: { name: string; date: string; retentionDays: number }) => Promise<void>;
  onClose: () => void;
}

export function EventForm({ event, onSubmit, onClose }: EventFormProps) {
  const [name, setName] = useState(event?.name ?? '');
  const [date, setDate] = useState(event?.date ?? '');
  const [retentionDays, setRetentionDays] = useState(() => {
    if (!event) return 90;
    // Calculate retention from existing event dates
    const eventDate = new Date(event.date);
    const expiresAt = new Date(event.expiresAt);
    const diffDays = Math.round((expiresAt.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 90;
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        await onSubmit({ name, date, retentionDays });
      } finally {
        setSubmitting(false);
      }
    },
    [name, date, retentionDays, onSubmit]
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{event ? 'Edit Event' : 'New Wedding Event'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="event-name">Event Name</label>
            <input
              id="event-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah & John's Wedding"
              required
              maxLength={200}
            />
          </div>
          <div className="form-group">
            <label htmlFor="event-date">Wedding Date</label>
            <input
              id="event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="retention-days">Data Retention (days after event)</label>
            <input
              id="retention-days"
              type="number"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              min={7}
              max={365}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : event ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
