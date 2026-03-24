import { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { uploadCoupleImage, validateUploadToken } from '@/services/api';
import type { UploadResponse } from '@/types/api';

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  result?: UploadResponse;
  error?: string;
}

export function CoupleUpload() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [eventName, setEventName] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (!eventId || !token) {
      setValidating(false);
      return;
    }

    validateUploadToken(eventId, token)
      .then((data) => {
        setEventName(data.name);
        setTokenValid(true);
      })
      .catch(() => setTokenValid(false))
      .finally(() => setValidating(false));
  }, [eventId, token]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!eventId || !token) return;

      const newItems: UploadItem[] = acceptedFiles.map((file) => ({
        file,
        status: 'pending' as const,
      }));
      setUploads((prev) => [...prev, ...newItems]);

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        setUploads((prev) =>
          prev.map((item) =>
            item.file === file ? { ...item, status: 'uploading' } : item
          )
        );

        try {
          const result = await uploadCoupleImage(eventId, token, file);
          setUploads((prev) =>
            prev.map((item) =>
              item.file === file ? { ...item, status: 'done', result } : item
            )
          );
        } catch (err) {
          setUploads((prev) =>
            prev.map((item) =>
              item.file === file
                ? {
                    ...item,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Upload failed',
                  }
                : item
            )
          );
        }
      }
    },
    [eventId, token]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'] },
    maxSize: 10 * 1024 * 1024,
  });

  if (validating) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <p style={{ color: 'var(--text-muted)' }}>Validating upload link...</p>
      </div>
    );
  }

  if (!tokenValid || !eventId || !token) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 120 }}>
        <div className="card" style={{ maxWidth: 500, margin: '0 auto' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: 12 }}>Invalid Upload Link</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            This upload link is invalid or has expired. Please contact the event organizer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 48 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ marginBottom: 8 }}>💍 {eventName ?? 'Wedding'}</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Upload your photos as the couple. These will be included in every guest's download.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <p style={{ fontSize: '2rem' }}>📷</p>
        <p>
          {isDragActive
            ? 'Drop your photos here...'
            : 'Drag & drop photos here, or click to browse'}
        </p>
        <p style={{ fontSize: '0.8rem', marginTop: 8 }}>
          JPG/PNG only, max 10MB per file
        </p>
      </div>

      {uploads.length > 0 && (
        <div className="card upload-progress" style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Uploads</h3>
          {uploads.map((item, i) => (
            <div className="upload-item" key={i}>
              <span style={{ fontSize: '0.9rem' }}>{item.file.name}</span>
              <span>
                {item.status === 'pending' && (
                  <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                )}
                {item.status === 'uploading' && (
                  <span style={{ color: 'var(--primary)' }}>Uploading...</span>
                )}
                {item.status === 'done' && (
                  <span style={{ color: 'var(--success)' }}>✓ Done</span>
                )}
                {item.status === 'error' && (
                  <span style={{ color: 'var(--danger)' }}>✗ {item.error}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
