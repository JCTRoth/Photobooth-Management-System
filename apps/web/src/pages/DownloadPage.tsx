import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDownloadPageData, getImageFileUrl, getZipDownloadUrl } from '@/services/api';
import type { DownloadPageData } from '@/types/api';

export function DownloadPage() {
  const { imageId } = useParams<{ imageId: string }>();
  const [data, setData] = useState<DownloadPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageId) return;
    getDownloadPageData(imageId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [imageId]);

  if (loading) {
    return (
      <div className="download-page">
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  if (error || !data || !imageId) {
    return (
      <div className="download-page">
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: 12 }}>Image Not Found</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            This download link may have expired or the image has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="download-page">
      <div className="download-card card">
        <img src={getImageFileUrl(imageId)} alt="Your photobooth photo" />
        <h2 style={{ marginBottom: 8 }}>Your Photobooth Photo! 📸</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
          Download your photo or get all photos as a ZIP (includes couple portraits).
        </p>
        <div className="download-actions">
          <a
            href={getImageFileUrl(imageId)}
            download={data.filename}
            className="btn-primary"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              borderRadius: 'var(--radius)',
            }}
          >
            ⬇ Download Photo
          </a>
          <a
            href={getZipDownloadUrl(imageId)}
            download
            className="btn-secondary"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            📦 Download All (ZIP)
          </a>
        </div>
      </div>
    </div>
  );
}
