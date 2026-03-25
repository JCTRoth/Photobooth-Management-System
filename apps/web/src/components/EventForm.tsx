import { useState, useCallback } from 'react';
import type { EventResponse, SlideshowAlbumInput, SlideshowAlbumMode, SlideshowAlbumSource } from '@/types/api';

interface EventFormValues {
  name: string;
  date: string;
  retentionDays: number;
  slideshowAlbums: SlideshowAlbumInput[];
}

interface EventFormProps {
  event?: EventResponse;
  onSubmit: (data: EventFormValues) => Promise<void>;
  onClose: () => void;
}

const SOURCE_OPTIONS: Array<{ value: SlideshowAlbumSource; label: string }> = [
  { value: 'all', label: 'All photos' },
  { value: 'guest', label: 'Guest uploads' },
  { value: 'couple', label: 'Couple portraits' },
];

const MODE_OPTIONS: Array<{ value: SlideshowAlbumMode; label: string; description: string }> = [
  { value: 'cinema', label: 'Cinema', description: 'Single-image full-screen fade' },
  { value: 'mosaic', label: 'Mosaic', description: 'Featured image with collage previews' },
  { value: 'spotlight', label: 'Spotlight', description: 'Hero frame with thumbnail filmstrip' },
];

function createDefaultAlbums(): SlideshowAlbumInput[] {
  return [
    { name: 'Highlights', source: 'all', mode: 'cinema' },
    { name: 'Guest Floor', source: 'guest', mode: 'mosaic' },
    { name: 'Couple Portraits', source: 'couple', mode: 'spotlight' },
  ];
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
  const [slideshowAlbums, setSlideshowAlbums] = useState<SlideshowAlbumInput[]>(
    event?.slideshowAlbums.map((album) => ({
      name: album.name,
      source: album.source,
      mode: album.mode,
    })) ?? createDefaultAlbums()
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        await onSubmit({
          name,
          date,
          retentionDays,
          slideshowAlbums: slideshowAlbums.filter((album) => album.name.trim() !== ''),
        });
      } finally {
        setSubmitting(false);
      }
    },
    [date, name, onSubmit, retentionDays, slideshowAlbums]
  );

  const updateAlbum = useCallback(
    <K extends keyof SlideshowAlbumInput>(index: number, key: K, value: SlideshowAlbumInput[K]) => {
      setSlideshowAlbums((current) =>
        current.map((album, albumIndex) =>
          albumIndex === index
            ? {
                ...album,
                [key]: value,
              }
            : album
        )
      );
    },
    []
  );

  const addAlbum = useCallback(() => {
    setSlideshowAlbums((current) => [
      ...current,
      {
        name: `Album ${current.length + 1}`,
        source: 'all',
        mode: 'cinema',
      },
    ]);
  }, []);

  const removeAlbum = useCallback((index: number) => {
    setSlideshowAlbums((current) => current.filter((_, albumIndex) => albumIndex !== index));
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
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

          <div className="form-group">
            <label>Slideshow Albums</label>
            <p className="form-helper-text">
              Create multiple public slideshow albums for the same event and choose a different display mode for each
              one.
            </p>

            <div className="slideshow-album-editor-list">
              {slideshowAlbums.map((album, index) => (
                <div key={`${album.name}-${index}`} className="slideshow-album-editor">
                  <div className="slideshow-album-editor-header">
                    <strong>Album {index + 1}</strong>
                    {slideshowAlbums.length > 1 && (
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        onClick={() => removeAlbum(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="slideshow-album-editor-grid">
                    <label>
                      Album name
                      <input
                        type="text"
                        value={album.name}
                        onChange={(e) => updateAlbum(index, 'name', e.target.value)}
                        placeholder="e.g. Dance Floor"
                        maxLength={80}
                        required
                      />
                    </label>

                    <label>
                      Photo source
                      <select
                        value={album.source}
                        onChange={(e) => updateAlbum(index, 'source', e.target.value as SlideshowAlbumSource)}
                      >
                        {SOURCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Display mode
                      <select
                        value={album.mode}
                        onChange={(e) => updateAlbum(index, 'mode', e.target.value as SlideshowAlbumMode)}
                      >
                        {MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <p className="form-helper-text" style={{ marginTop: 10 }}>
                    {MODE_OPTIONS.find((option) => option.value === album.mode)?.description}
                  </p>
                </div>
              ))}
            </div>

            <button type="button" className="btn-secondary" onClick={addAlbum} style={{ marginTop: 12 }}>
              + Add Album
            </button>
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
