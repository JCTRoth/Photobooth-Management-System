import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getEventImages, deleteImage, updateImageCaption, getImageFileUrl } from '@/services/api';
import type { ImageResponse } from '@/types/api';
import { logout } from '@/services/api';
import { useNavigate } from 'react-router-dom';

export function MyGallery() {
  const { eventId, eventName, clearAuth } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const data = await getEventImages(eventId);
      setImages(data.images);
    } catch {
      setError('Could not load photos.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch { /* show nothing, keep image */ }
  };

  const startEditCaption = (img: ImageResponse) => {
    setEditingCaption(img.id);
    setCaptionValue(img.caption ?? '');
  };

  const saveCaption = async (id: string) => {
    setSaving(true);
    try {
      await updateImageCaption(id, captionValue.trim() || null);
      setImages((prev) =>
        prev.map((img) => img.id === id ? { ...img, caption: captionValue.trim() || undefined } : img)
      );
      setEditingCaption(null);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    clearAuth();
    navigate('/', { replace: true });
  };

  if (!eventId) return null;

  return (
    <div>
      <nav className="nav">
        <span className="nav-brand">📸 {eventName ?? 'Wedding Photos'}</span>
        <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
      </nav>
      <div className="container">
        <h1 style={{ marginBottom: 24 }}>{eventName}</h1>

        {loading && <p>Loading photos…</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {!loading && images.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No photos yet.</p>}

        <div className="gallery-grid">
          {images.map((img) => (
            <div key={img.id} className="gallery-card">
              <img
                src={getImageFileUrl(img.id)}
                alt={img.caption ?? `Photo`}
                className="gallery-img"
              />
              <div className="gallery-card-body">
                {editingCaption === img.id ? (
                  <div className="caption-edit">
                    <input
                      value={captionValue}
                      onChange={(e) => setCaptionValue(e.target.value)}
                      maxLength={500}
                      placeholder="Add a caption…"
                      autoFocus
                      className="caption-input"
                    />
                    <div className="caption-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => saveCaption(img.id)} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingCaption(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="caption-display">
                    <span className="caption-text">
                      {img.caption ?? <em style={{ color: 'var(--text-muted)' }}>No caption</em>}
                    </span>
                    <div className="gallery-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => startEditCaption(img)}>
                        ✏️ {img.caption ? 'Edit' : 'Add'} caption
                      </button>
                      <a
                        className="btn btn-ghost btn-sm"
                        href={`/download/${img.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ⬇️ Download
                      </a>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(img.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
