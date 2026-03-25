import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDevices, getEvent, getEventImages, getImageFileUrl } from '@/services/api';
import type { EventResponse, ImageResponse } from '@/types/api';
import type { DeviceSummary } from '@/types/device';
import { MarriageInvitePanel } from '@/components/MarriageInvitePanel';

export function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [assignedDevices, setAssignedDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [ev, imgs, deviceData] = await Promise.all([
        getEvent(eventId),
        getEventImages(eventId),
        getDevices(),
      ]);
      setEvent(ev);
      setImages(imgs.images);
      setAssignedDevices(deviceData.devices.filter((device) => device.assignedEvent?.eventId === eventId));
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
        <Link to="/admin" style={{ marginTop: 16, display: 'inline-block' }}>Back to Events</Link>
      </div>
    );
  }

  const isExpired = new Date(event.expiresAt) < new Date();
  const coupleImages = images.filter((i) => i.type === 'Couple');
  const guestImages = images.filter((i) => i.type === 'Guest');
  const getAlbumImageCount = (source: string) => {
    switch (source) {
      case 'guest':
        return guestImages.length;
      case 'couple':
        return coupleImages.length;
      default:
        return images.length;
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/admin" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Back to Events
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
            href={`/slideshow/${event.id}${event.slideshowAlbums[0] ? `?album=${encodeURIComponent(event.slideshowAlbums[0].slug)}` : ''}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '1.2rem', marginTop: 4, display: 'block' }}
          >
            🖥 Open {event.slideshowAlbums[0]?.name ?? 'Show'}
          </a>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 32 }}>
        <div className="section-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Assigned Photobooths</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Devices currently mapped to this event and allowed to upload guest photos.
            </p>
          </div>
          <Link to="/admin/devices" className="copy-btn">
            Manage Devices
          </Link>
        </div>

        {assignedDevices.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            No photobooth device is assigned yet. Guest uploads from booths will stay blocked until you assign one.
          </p>
        ) : (
          <div className="device-chip-grid">
            {assignedDevices.map((device) => (
              <Link key={device.id} to={`/admin/devices/${device.id}`} className="device-chip">
                <strong>{device.name}</strong>
                <span>{device.connectivity === 'online' ? 'Online now' : device.lastSeenAt ? `Last seen ${new Date(device.lastSeenAt).toLocaleString()}` : 'Never seen'}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: 32 }}>
        <div className="section-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Slideshow Albums</h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Each album can focus on a different photo set and display mode for the public slideshow screen.
            </p>
          </div>
        </div>

        <div className="slideshow-album-card-grid">
          {event.slideshowAlbums.map((album) => (
            <a
              key={album.slug}
              href={`/slideshow/${event.id}?album=${encodeURIComponent(album.slug)}`}
              target="_blank"
              rel="noreferrer"
              className="slideshow-album-card"
            >
              <span className="slideshow-album-card-mode">{album.mode}</span>
              <strong>{album.name}</strong>
              <p>{album.source === 'all' ? 'All photos' : album.source === 'guest' ? 'Guest uploads only' : 'Couple portraits only'}</p>
              <div className="slideshow-album-card-footer">
                <span>{getAlbumImageCount(album.source)} photos</span>
                <span>Open album</span>
              </div>
            </a>
          ))}
        </div>
      </section>

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

      <MarriageInvitePanel eventId={event.id} />
    </>
  );
}
