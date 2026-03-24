import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEvent, getEventImages, getImageFileUrl } from '@/services/api';
import type { EventResponse, ImageResponse } from '@/types/api';

export function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const [ev, imgs] = await Promise.all([
        getEvent(eventId),
        getEventImages(eventId),
      ]);
      setEvent(ev);
      setImages(imgs.images);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', padding: 20 }}>Loading...</p>;
  }

  if (error || !event) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger)' }}>Event Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>{error}</p>
        <Link to="/" style={{ marginTop: 16, display: 'inline-block' }}>← Back to Events</Link>
      </div>
    );
  }

  const isExpired = new Date(event.expiresAt) < new Date();
  const coupleImages = images.filter((i) => i.type === 'Couple');
  const guestImages = images.filter((i) => i.type === 'Guest');

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ← Back to Events
          </Link>
          <h1 style={{ marginTop: 4 }}>{event.name}</h1>
        </div>
        <span className={isExpired ? 'status-expired' : 'status-active'}>
          {isExpired ? 'Expired' : 'Active'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</div>
          <div style={{ fontSize: '1.2rem', marginTop: 4 }}>{event.date}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Photos</div>
          <div style={{ fontSize: '1.2rem', marginTop: 4 }}>{images.length}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expires</div>
          <div style={{ fontSize: '1.2rem', marginTop: 4 }}>{new Date(event.expiresAt).toLocaleDateString()}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slideshow</div>
          <a
            href={`/slideshow/${event.id}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '1.2rem', marginTop: 4, display: 'block' }}
          >
            🖥 Open
          </a>
        </div>
      </div>

      {coupleImages.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16, fontSize: '1.2rem' }}>
            Couple Photos <span className="badge badge-couple">{coupleImages.length}</span>
          </h2>
          <div className="image-grid">
            {coupleImages.map((img) => (
              <div key={img.id} className="image-card">
                <img src={getImageFileUrl(img.id)} alt={img.filename} loading="lazy" />
                <div className="image-card-footer">
                  <span className="badge badge-couple">Couple</span>
                  <a href={getImageFileUrl(img.id)} download={img.filename} className="copy-btn">
                    ⬇ Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {guestImages.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16, fontSize: '1.2rem' }}>
            Guest Photos <span className="badge badge-guest">{guestImages.length}</span>
          </h2>
          <div className="image-grid">
            {guestImages.map((img) => (
              <div key={img.id} className="image-card">
                <img src={getImageFileUrl(img.id)} alt={img.filename} loading="lazy" />
                <div className="image-card-footer">
                  <span className="badge badge-guest">Guest</span>
                  <a href={img.downloadUrl} className="copy-btn" style={{ marginRight: 4 }}>
                    🔗 QR Link
                  </a>
                  <a href={getImageFileUrl(img.id)} download={img.filename} className="copy-btn">
                    ⬇
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {images.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ fontSize: '2rem', marginBottom: 8 }}>📷</p>
          <p style={{ color: 'var(--text-muted)' }}>
            No photos yet. Share the couple upload link or start the photobooth!
          </p>
        </div>
      )}
    </>
  );
}
