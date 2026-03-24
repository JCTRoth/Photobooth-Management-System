import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getEventImages, getImageFileUrl } from '@/services/api';
import type { ImageResponse } from '@/types/api';

const SLIDE_INTERVAL_MS = 5000;
const POLL_INTERVAL_MS = 15000;
const FADE_DURATION_MS = 600;
const SWIPE_THRESHOLD = 50;

export function SlideshowPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const preloadedRef = useRef<Set<string>>(new Set());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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

  const goToPrevious = useCallback(() => {
    setFadeIn(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      setFadeIn(true);
    }, FADE_DURATION_MS / 2);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setFadeIn(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setFadeIn(true);
    }, FADE_DURATION_MS / 2);
  }, [images.length]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    const dx = touchStartRef.current.x - touchEnd.x;
    const dy = touchStartRef.current.y - touchEnd.y;

    // Only consider horizontal swipes
    if (Math.abs(dy) < Math.abs(dx)) {
      if (dx > SWIPE_THRESHOLD) {
        // Swiped left → next
        goToNext();
      } else if (dx < -SWIPE_THRESHOLD) {
        // Swiped right → previous
        goToPrevious();
      }
    }
    touchStartRef.current = null;
  }, [goToNext, goToPrevious]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target === document.body) {
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          setIsPlaying(false);
          break;
        case 'ArrowRight':
          goToNext();
          setIsPlaying(false);
          break;
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'Escape':
          window.history.back();
          break;
        default:
          break;
      }
    }
  }, [goToPrevious, goToNext, togglePlayPause]);

  // Initial load + polling for new images
  useEffect(() => {
    loadImages();
    const pollTimer = setInterval(loadImages, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimer);
  }, [loadImages]);

  // Keyboard navigation
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset index when image list changes to prevent out-of-bounds
  useEffect(() => {
    setCurrentIndex((prev) => {
      if (images.length === 0) return 0;
      return prev >= images.length ? 0 : prev;
    });
  }, [images.length]);

  // Auto-advance slides
  useEffect(() => {
    if (images.length <= 1 || !isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

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
  }, [images.length, isPlaying]);

  // Cleanup controls timeout
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

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
    <div
      className="slideshow-container"
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-live="polite"
      aria-label="Photo slideshow"
    >
      <img
        key={currentImage.id}
        src={getImageFileUrl(currentImage.id)}
        alt={`Photo ${currentIndex + 1}`}
        style={{
          opacity: fadeIn ? 1 : 0,
          transition: `opacity ${FADE_DURATION_MS / 2}ms ease-in-out`,
        }}
      />
      
      {/* Navigation Buttons */}
      {images.length > 1 && showControls && (
        <>
          <button
            className="slideshow-btn slideshow-btn-prev"
            onClick={goToPrevious}
            aria-label="Previous photo"
            title="Previous (← or swipe right)"
          >
            ‹
          </button>
          <button
            className="slideshow-btn slideshow-btn-next"
            onClick={goToNext}
            aria-label="Next photo"
            title="Next (→ or swipe left)"
          >
            ›
          </button>
        </>
      )}

      {/* Controls Bar */}
      {showControls && (
        <div className="slideshow-controls">
          <button
            className="slideshow-play-btn"
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div className="slideshow-counter">
            {currentIndex + 1} / {images.length}
          </div>
          <div className="slideshow-info" title="Press ? for help">
            {isPlaying ? '▶ Playing' : '⏸ Paused'}
          </div>
        </div>
      )}

      {/* Keyboard Help Hint */}
      {showControls && (
        <div className="slideshow-help">
          ← → arrow keys · Space to pause · Esc to exit
        </div>
      )}
    </div>
  );
}
