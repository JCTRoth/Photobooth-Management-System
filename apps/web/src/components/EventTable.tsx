import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventResponse } from '@/types/api';

interface EventTableProps {
  events: EventResponse[];
  onEdit: (event: EventResponse) => void;
  onDelete: (id: string) => void;
}

export function EventTable({ events, onEdit, onDelete }: EventTableProps) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table className="event-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Date</th>
            <th>Photos</th>
            <th>Status</th>
            <th>Upload Link</th>
            <th>Slideshow</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: EventResponse;
  onEdit: (e: EventResponse) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isExpired = new Date(event.expiresAt) < new Date();

  const coupleUrl = `${window.location.origin}/event/${event.id}/upload?token=${event.uploadToken}`;
  const slideshowUrl = `${window.location.origin}/slideshow/${event.id}`;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <tr>
      <td style={{ fontWeight: 500 }}>
        <Link to={`/events/${event.id}`}>{event.name}</Link>
      </td>
      <td>{event.date}</td>
      <td>{event.imageCount}</td>
      <td>
        <span className={isExpired ? 'status-expired' : 'status-active'}>
          {isExpired ? 'Expired' : 'Active'}
        </span>
      </td>
      <td>
        <button className="copy-btn" onClick={() => copyToClipboard(coupleUrl)}>
          {copied ? '✓ Copied' : '📋 Copy Link'}
        </button>
      </td>
      <td>
        <a href={slideshowUrl} target="_blank" rel="noreferrer" className="copy-btn" style={{ textDecoration: 'none' }}>
          🖥 Open
        </a>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => onEdit(event)} style={{ padding: '4px 12px', fontSize: '0.85rem' }}>
            Edit
          </button>
          <button className="btn-danger" onClick={() => onDelete(event.id)} style={{ padding: '4px 12px', fontSize: '0.85rem' }}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
