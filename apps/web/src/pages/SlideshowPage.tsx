import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getEvent, getEventImages, getImageFileUrl } from '@/services/api';
import type { EventResponse, ImageResponse, SlideshowAlbum } from '@/types/api';

const POLL_INTERVAL_MS = 15000;
const FADE_DURATION_MS = 600;
const SWIPE_THRESHOLD = 50;
const MODE_INTERVALS: Record<SlideshowAlbum['mode'], number> = {
  cinema: 5000,
  mosaic: 4200,
  spotlight: 5600,
};

function filterImagesForAlbum(images: ImageResponse[], album: SlideshowAlbum | null) {
  if (!album) return images;

  switch (album.source) {
    case 'guest':
      return images.filter((image) => image.type === 'Guest');
    case 'couple':
      return images.filter((image) => image.type === 'Couple');
    default:
      return images;
  }
}

function getRotatingSlides(images: ImageResponse[], startIndex: number, count: number) {
  if (images.length === 0) return [];

  return Array.from({ length: Math.min(count, images.length) }, (_, offset) => {
    const index = (startIndex + offset) % images.length;
    return images[index];
  });
}

function getAlbumModeLabel(mode: SlideshowAlbum['mode']) {
  switch (mode) {
    case 'mosaic':
      return 'Mosaic mode';
    case 'spotlight':
      return 'Spotlight mode';
    default:
      return 'Cinema mode';
  }
}

function getAlbumSourceLabel(source: SlideshowAlbum['source']) {
  switch (source) {
    case 'guest':
      return 'Guest uploads only';
    case 'couple':
      return 'Couple portraits only';
    default:
      return 'All event photos';
  }
}

export function SlideshowPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const preloadedRef = useRef<Set<string>>(new Set());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const loadData = useCallback(async () => {
    if (!eventId) return;

    try {
      const [eventData, imageData] = await Promise.all([getEvent(eventId), getEventImages(eventId)]);
      setEvent(eventData);
      setImages(imageData.images);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load slideshow');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
    const pollTimer = setInterval(loadData, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimer);
  }, [loadData]);

  const albums = event?.slideshowAlbums ?? [];
  const requestedAlbumSlug = searchParams.get('album');
  const activeAlbum = albums.find((album) => album.slug === requestedAlbumSlug) ?? albums[0] ?? null;
  const activeImages = filterImagesForAlbum(images, activeAlbum);
  const currentImage = activeImages.length > 0 ? activeImages[currentIndex % activeImages.length] : null;
  const albumSlides = getRotatingSlides(activeImages, currentIndex, activeAlbum?.mode === 'spotlight' ? 7 : 5);

  useEffect(() => {
    if (!activeAlbum || requestedAlbumSlug === activeAlbum.slug) return;

    const next = new URLSearchParams(searchParams);
    next.set('album', activeAlbum.slug);
    setSearchParams(next, { replace: true });
  }, [activeAlbum, requestedAlbumSlug, searchParams, setSearchParams]);

  useEffect(() => {
    setCurrentIndex(0);
    setFadeIn(true);
    preloadedRef.current.clear();
  }, [activeAlbum?.slug]);

  useEffect(() => {
    setCurrentIndex((prev) => {
      if (activeImages.length === 0) return 0;
      return prev >= activeImages.length ? 0 : prev;
    });
  }, [activeImages.length]);

  useEffect(() => {
    if (activeImages.length < 2) return;

    const nextIndex = (currentIndex + 1) % activeImages.length;
    const nextImage = activeImages[nextIndex];
    if (nextImage && !preloadedRef.current.has(nextImage.id)) {
      const img = new Image();
      img.src = getImageFileUrl(nextImage.id);
      preloadedRef.current.add(nextImage.id);
    }
  }, [activeImages, currentIndex]);

  const goToPrevious = useCallback(() => {
    if (activeImages.length <= 1) return;

    setFadeIn(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev === 0 ? activeImages.length - 1 : prev - 1));
      setFadeIn(true);
    }, FADE_DURATION_MS / 2);
  }, [activeImages.length]);

  const goToNext = useCallback(() => {
    if (activeImages.length <= 1) return;

    setFadeIn(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeImages.length);
      setFadeIn(true);
    }, FADE_DURATION_MS / 2);
  }, [activeImages.length]);

  const jumpToImage = useCallback(
    (imageId: string) => {
      const imageIndex = activeImages.findIndex((image) => image.id === imageId);
      if (imageIndex < 0) return;

      setFadeIn(false);
      setTimeout(() => {
        setCurrentIndex(imageIndex);
        setFadeIn(true);
      }, FADE_DURATION_MS / 3);
    },
    [activeImages]
  );

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
    }, 3200);
  }, [isPlaying]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      const dx = touchStartRef.current.x - touchEnd.x;
      const dy = touchStartRef.current.y - touchEnd.y;

      if (Math.abs(dy) < Math.abs(dx)) {
        if (dx > SWIPE_THRESHOLD) {
          goToNext();
        } else if (dx < -SWIPE_THRESHOLD) {
          goToPrevious();
        }
      }

      touchStartRef.current = null;
    },
    [goToNext, goToPrevious]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target !== document.body) return;

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
    },
    [goToNext, goToPrevious, togglePlayPause]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (activeImages.length <= 1 || !isPlaying || !activeAlbum) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % activeImages.length);
        setFadeIn(true);
      }, FADE_DURATION_MS / 2);
    }, MODE_INTERVALS[activeAlbum.mode]);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeAlbum, activeImages.length, isPlaying]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  if (!eventId) {
    return <div className="slideshow-container">Invalid event</div>;
  }

  if (loading) {
    return (
      <div className="slideshow-container">
        <div className="slideshow-empty-card">
          <p style={{ fontSize: '3rem', marginBottom: 16 }}>⏳</p>
          <strong>Loading slideshow</strong>
          <p>Fetching event details, albums, and latest photos...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="slideshow-container">
        <div className="slideshow-empty-card">
          <p style={{ fontSize: '3rem', marginBottom: 16 }}>⚠</p>
          <strong>Unable to load slideshow</strong>
          <p>{error ?? 'The event could not be found.'}</p>
        </div>
      </div>
    );
  }

  const renderStage = () => {
    if (!currentImage || !activeAlbum) return null;

    if (activeAlbum.mode === 'mosaic') {
      return (
        <div className="slideshow-stage slideshow-mosaic">
          <div className="slideshow-mosaic-hero">
            <img
              src={getImageFileUrl(currentImage.id)}
              alt={currentImage.filename}
              className="slideshow-stage-image"
              style={{ opacity: fadeIn ? 1 : 0, transition: `opacity ${FADE_DURATION_MS / 2}ms ease-in-out` }}
            />
          </div>
          <div className="slideshow-mosaic-grid">
            {albumSlides.slice(1).map((image) => (
              <div key={image.id} className="slideshow-mosaic-tile">
                <img src={getImageFileUrl(image.id)} alt={image.filename} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeAlbum.mode === 'spotlight') {
      return (
        <div className="slideshow-stage slideshow-spotlight">
          <div className="slideshow-spotlight-main">
            <img
              src={getImageFileUrl(currentImage.id)}
              alt={currentImage.filename}
              className="slideshow-stage-image"
              style={{ opacity: fadeIn ? 1 : 0, transition: `opacity ${FADE_DURATION_MS / 2}ms ease-in-out` }}
            />
            <div className="slideshow-spotlight-caption">
              <span>{activeAlbum.name}</span>
              <strong>{event.name}</strong>
            </div>
          </div>

          <div className="slideshow-filmstrip">
            {albumSlides.map((image) => (
              <button
                key={image.id}
                type="button"
                className={`slideshow-filmstrip-item${image.id === currentImage.id ? ' is-active' : ''}`}
                onClick={() => {
                  setIsPlaying(false);
                  jumpToImage(image.id);
                }}
              >
                <img src={getImageFileUrl(image.id)} alt={image.filename} />
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="slideshow-stage slideshow-cinema">
        <div className="slideshow-stage-frame">
          <img
            src={getImageFileUrl(currentImage.id)}
            alt={currentImage.filename}
            className="slideshow-stage-image"
            style={{ opacity: fadeIn ? 1 : 0, transition: `opacity ${FADE_DURATION_MS / 2}ms ease-in-out` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={`slideshow-container slideshow-mode-${activeAlbum?.mode ?? 'cinema'}`}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-live="polite"
      aria-label="Photo slideshow"
    >
      {currentImage && (
        <>
          <div
            className="slideshow-background-layer"
            style={{ backgroundImage: `url(${getImageFileUrl(currentImage.id)})` }}
          />
          <div className="slideshow-background-overlay" />
        </>
      )}

      {showControls && activeAlbum && (
        <div className="slideshow-topbar">
          <div className="slideshow-topbar-copy">
            <span className="slideshow-eyebrow">{event.name}</span>
            <strong>{activeAlbum.name}</strong>
            <p>
              {getAlbumModeLabel(activeAlbum.mode)} · {getAlbumSourceLabel(activeAlbum.source)}
            </p>
          </div>

          <div className="slideshow-album-switcher" role="tablist" aria-label="Slideshow albums">
            {albums.map((album) => (
              <button
                key={album.slug}
                type="button"
                className={`slideshow-album-chip${album.slug === activeAlbum.slug ? ' is-active' : ''}`}
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set('album', album.slug);
                  setSearchParams(next);
                  setIsPlaying(true);
                }}
              >
                {album.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeImages.length === 0 ? (
        <div className="slideshow-empty-card">
          <p style={{ fontSize: '3rem', marginBottom: 16 }}>📸</p>
          <strong>{activeAlbum ? `${activeAlbum.name} is waiting for photos` : 'Waiting for photos...'}</strong>
          <p>
            {activeAlbum
              ? `This album is configured for ${getAlbumSourceLabel(activeAlbum.source).toLowerCase()}.`
              : 'Photos will appear here as they are taken.'}
          </p>
        </div>
      ) : (
        renderStage()
      )}

      {activeImages.length > 1 && showControls && (
        <>
          <button
            className="slideshow-btn slideshow-btn-prev"
            onClick={() => {
              setIsPlaying(false);
              goToPrevious();
            }}
            aria-label="Previous photo"
            title="Previous (← or swipe right)"
          >
            ‹
          </button>
          <button
            className="slideshow-btn slideshow-btn-next"
            onClick={() => {
              setIsPlaying(false);
              goToNext();
            }}
            aria-label="Next photo"
            title="Next (→ or swipe left)"
          >
            ›
          </button>
        </>
      )}

      {showControls && activeAlbum && (
        <div className="slideshow-controls">
          <div className="slideshow-controls-left">
            <button
              className="slideshow-play-btn"
              onClick={togglePlayPause}
              aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <div className="slideshow-counter">
              {activeImages.length === 0 ? 0 : currentIndex + 1} / {activeImages.length}
            </div>
          </div>

          <div className="slideshow-info">
            {getAlbumModeLabel(activeAlbum.mode)} · {isPlaying ? 'Playing' : 'Paused'}
          </div>
        </div>
      )}

      {showControls && (
        <div className="slideshow-help">
          Switch albums above · ← → navigate · Space pause · Esc exit
        </div>
      )}
    </div>
  );
}
