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

const SOURCE_OPTIONS: Array<{ value: SlideshowAlbumSource; label: string; description: string }> = [
  { value: 'all', label: 'All photos', description: 'Every photo from the event' },
  { value: 'guest', label: 'Guest uploads', description: 'Only photos uploaded by guests' },
  { value: 'couple', label: 'Couple portraits', description: 'Professional couple photos' },
];

const MODE_OPTIONS: Array<{ value: SlideshowAlbumMode; label: string; description: string; icon: string }> = [
  { value: 'cinema', label: 'Cinema', description: 'Single-image full-screen fade transitions', icon: '🎬' },
  { value: 'mosaic', label: 'Mosaic', description: 'Featured image with collage previews', icon: '🖼️' },
  { value: 'spotlight', label: 'Spotlight', description: 'Hero frame with thumbnail filmstrip', icon: '⭐' },
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const isFormValid = name.trim() && date && slideshowAlbums.some(album => album.name.trim());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-section">
            <div className="modal-icon">💒</div>
            <div>
              <h2>{event ? 'Edit Wedding Event' : 'Create New Wedding Event'}</h2>
              <p className="modal-subtitle">
                {event ? 'Update event details and slideshow settings' : 'Set up a new wedding event with custom slideshow albums'}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-content">
          <form onSubmit={handleSubmit} className="event-form">
            {/* Basic Information Section */}
            <div className="form-section">
              <div className="section-header">
                <h3>📅 Event Details</h3>
                <p>Basic information about the wedding</p>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="event-name">
                    Event Name <span className="required">*</span>
                  </label>
                  <input
                    id="event-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah & John's Wedding"
                    required
                    maxLength={200}
                    className="form-input-large"
                  />
                  <p className="field-help">This will be displayed on the guest gallery and slideshows</p>
                </div>

                <div className="form-group">
                  <label htmlFor="event-date">
                    Wedding Date <span className="required">*</span>
                  </label>
                  <input
                    id="event-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="form-input-medium"
                  />
                  <p className="field-help">The date when the wedding takes place</p>
                </div>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <div className="form-section">
              <button
                type="button"
                className="advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span className="toggle-icon">{showAdvanced ? '▼' : '▶'}</span>
                <span>Advanced Settings</span>
                <span className="toggle-hint">{showAdvanced ? 'Hide' : 'Show'} data retention and slideshow configuration</span>
              </button>
            </div>

            {/* Advanced Settings */}
            {showAdvanced && (
              <>
                <div className="form-section">
                  <div className="section-header">
                    <h3>🗂️ Data Management</h3>
                    <p>How long to keep photos and when to clean up</p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="retention-days">
                      Data Retention Period
                    </label>
                    <div className="input-with-unit">
                      <input
                        id="retention-days"
                        type="number"
                        value={retentionDays}
                        onChange={(e) => setRetentionDays(Number(e.target.value))}
                        min={7}
                        max={365}
                        className="form-input-small"
                      />
                      <span className="unit">days after wedding</span>
                    </div>
                    <p className="field-help">
                      Photos will be automatically deleted {retentionDays} days after the wedding date.
                      Choose longer for destination weddings, shorter for local events.
                    </p>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <h3>🎬 Slideshow Albums</h3>
                    <p>Create multiple public slideshows for different photo types</p>
                  </div>

                  <div className="album-instructions">
                    <div className="instruction-card">
                      <div className="instruction-icon">💡</div>
                      <div>
                        <strong>Multiple Albums</strong>
                        <p>Create separate slideshows for different photo types - one for dance floor moments, another for couple portraits, etc.</p>
                      </div>
                    </div>
                    <div className="instruction-card">
                      <div className="instruction-icon">🎨</div>
                      <div>
                        <strong>Display Modes</strong>
                        <p>Each album can have a different visual style - cinema for elegant fades, mosaic for collages, spotlight for featured photos.</p>
                      </div>
                    </div>
                  </div>

                  <div className="slideshow-album-editor-list">
                    {slideshowAlbums.map((album, index) => (
                      <div key={`${album.name}-${index}`} className="slideshow-album-editor">
                        <div className="album-header">
                          <div className="album-number">Album {index + 1}</div>
                          {slideshowAlbums.length > 1 && (
                            <button
                              type="button"
                              className="btn-danger btn-sm album-remove"
                              onClick={() => removeAlbum(index)}
                              title="Remove this album"
                            >
                              🗑️ Remove
                            </button>
                          )}
                        </div>

                        <div className="album-form-grid">
                          <div className="form-group">
                            <label>
                              Album Name <span className="required">*</span>
                            </label>
                            <input
                              type="text"
                              value={album.name}
                              onChange={(e) => updateAlbum(index, 'name', e.target.value)}
                              placeholder="e.g. Dance Floor Highlights"
                              maxLength={80}
                              required
                            />
                          </div>

                          <div className="form-group">
                            <label>Photo Source</label>
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
                            <p className="field-help">
                              {SOURCE_OPTIONS.find((option) => option.value === album.source)?.description}
                            </p>
                          </div>

                          <div className="form-group">
                            <label>Display Style</label>
                            <select
                              value={album.mode}
                              onChange={(e) => updateAlbum(index, 'mode', e.target.value as SlideshowAlbumMode)}
                            >
                              {MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.icon} {option.label}
                                </option>
                              ))}
                            </select>
                            <p className="field-help">
                              {MODE_OPTIONS.find((option) => option.value === album.mode)?.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="btn-secondary add-album-btn" onClick={addAlbum}>
                    ➕ Add Another Album
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting || !isFormValid} onClick={(e) => {
            // Handle form submission from modal actions
            const form = e.currentTarget.closest('.modal')?.querySelector('form');
            if (form) form.requestSubmit();
          }}>
            {submitting ? '🎯 Creating Event...' : event ? '💾 Update Event' : '🎉 Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
