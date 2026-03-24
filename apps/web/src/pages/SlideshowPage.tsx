import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getEventImages, getImageFileUrl } from '@/services/api';
import type { ImageResponse } from '@/types/api';

const SLIDE_INTERVAL_MS = 5000;
const POLL_INTERVAL_MS = 15000;
const FADE_DURATION_MS = 600;

export function SlideshowPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const preloadedRef = useRef<Set<string>>(new Set());

  const loadImages = useCallback(async () => {
    if (!eventId) return;
    try {
      const data = await getEventImages(eventId);
      setImages(data.images);
    } catch {
      // silently retry on next poll
    }
  }, [eventId]);

  // Preload upcoming images so transitions are smooth
  useEffect(() => {
    if (images.length < 2) return;
    const nextIndex = (currentIndex + 1) % images.length;
    const nextImage = images[nextIndex];
    if (nextImage && !preloadedRef.current.has(nextImage.id)) {
      const img = new Image();
      img.src = getImageFileUrl(nextImage.id);
      preloadedRef.current.add(nextImage.id);
    }
  }, [currentIndex, images]);

  // Initial load + polling for new images
  useEffect(() => {
    loadImages();
    const pollTimer = setInterval(loadImages, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimer);
  }, [loadImages]);

  // Reset index when image list changes to prevent out-of-bounds
  useEffect(() => {
    setCurrentIndex((prev) => {
      if (images.length === 0) return 0;
      return prev >= images.length ? 0 : prev;
    });
  }, [images.length]);

  // Auto-advance slides
  useEffect(() => {
    if (images.length <= 1) return;

    timerRef.current = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setFadeIn(true);
      }, FADE_DURATION_MS / 2);
    }, SLIDE_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [images.length]);

  if (!eventId) {
    return <div className="slideshow-container">Invalid event</div>;
  }

  if (images.length === 0) {
    return (
      <div className="slideshow-container">
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '3rem', marginBottom: 16 }}>📸</p>
          <p style={{ color: '#888', fontSize: '1.5rem' }}>
            Waiting for photos...
          </p>
          <p style={{ color: '#555', marginTop: 8 }}>
            Photos will appear here as they are taken
          </p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex % images.length];

  return (
    <div className="slideshow-container">
      <img
        key={currentImage.id}
        src={getImageFileUrl(currentImage.id)}
        alt={`Photo ${currentIndex + 1}`}
        style={{
          opacity: fadeIn ? 1 : 0,
          transition: `opacity ${FADE_DURATION_MS / 2}ms ease-in-out`,
        }}
      />
      <div className="slideshow-counter">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}
