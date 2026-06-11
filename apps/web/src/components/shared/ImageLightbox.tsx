'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';

export interface LightboxImage {
  id: string;
  src?: string;
  /** Async-Variante — wenn nicht alle URLs vorab geladen sind (z.B. Auth-Proxy). */
  fetchSrc?: () => Promise<string>;
  alt?: string;
  caption?: string;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  startIdx?: number;
  open: boolean;
  onClose: () => void;
  /** Optional Download-Handler — wenn gesetzt, erscheint Download-Button. */
  onDownload?: (img: LightboxImage) => void;
}

const SWIPE_THRESHOLD = 50; // px
const PINCH_ZOOM_MAX = 4;
const PINCH_ZOOM_MIN = 1;
const DOUBLE_TAP_DELAY = 280; // ms

/**
 * ImageLightbox — Vollbild-Bildergalerie mit:
 * - Swipe links/rechts zum Navigieren (Touch)
 * - Pinch-Zoom (Touch)
 * - Double-Tap zum Zoomen
 * - Tastatur: Pfeile, ESC, +/-
 * - Lazy-Loading via fetchSrc fuer Auth-geschuetzte Bilder
 * - Pre-Fetching von next/prev fuer fluessige Navigation
 */
export function ImageLightbox({ images, startIdx = 0, open, onClose, onDownload }: ImageLightboxProps) {
  const [idx, setIdx] = useState(startIdx);
  const [srcCache, setSrcCache] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);

  // Reset idx wenn lightbox neu oeffnet
  useEffect(() => { if (open) setIdx(startIdx); }, [open, startIdx]);

  // Reset zoom/pan bei Bild-Wechsel
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [idx]);

  // Body-Scroll-Lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Aktuelles Bild laden (+ Vorab next/prev)
  useEffect(() => {
    if (!open || images.length === 0) return;
    const targets = [idx, idx + 1, idx - 1].filter((i) => i >= 0 && i < images.length);
    for (const i of targets) {
      const img = images[i];
      if (!img || srcCache[img.id]) continue;
      if (img.src) {
        setSrcCache((c) => ({ ...c, [img.id]: img.src! }));
        continue;
      }
      if (img.fetchSrc) {
        if (i === idx) setLoading(true);
        img.fetchSrc()
          .then((url) => setSrcCache((c) => ({ ...c, [img.id]: url })))
          .catch(() => {})
          .finally(() => { if (i === idx) setLoading(false); });
      }
    }
  }, [open, idx, images, srcCache]);

  // Tastatur
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(PINCH_ZOOM_MAX, z + 0.5));
      if (e.key === '-') setZoom((z) => { const nz = Math.max(PINCH_ZOOM_MIN, z - 0.5); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; });
      if (e.key === '0') { setZoom(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, images.length]);

  function next() { setIdx((i) => Math.min(images.length - 1, i + 1)); }
  function prev() { setIdx((i) => Math.max(0, i - 1)); }

  // -------------------------------------------------------------------
  // Touch-Handler
  // -------------------------------------------------------------------

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      // Pinch start
      const dist = touchDistance(e.touches[0], e.touches[1]);
      pinchStartRef.current = { dist, zoom };
      return;
    }
    if (e.touches.length === 1 && zoom === 1) {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };

      // Double-Tap detection
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        // Toggle Zoom
        setZoom((z) => (z > 1 ? 1 : 2));
        if (zoom > 1) setPan({ x: 0, y: 0 });
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault();
      const dist = touchDistance(e.touches[0], e.touches[1]);
      const ratio = dist / pinchStartRef.current.dist;
      const nextZoom = Math.max(PINCH_ZOOM_MIN, Math.min(PINCH_ZOOM_MAX, pinchStartRef.current.zoom * ratio));
      setZoom(nextZoom);
      return;
    }
    if (e.touches.length === 1 && zoom > 1) {
      // Pan
      const t = e.touches[0];
      if (touchStartRef.current) {
        const dx = t.clientX - touchStartRef.current.x;
        const dy = t.clientY - touchStartRef.current.y;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      }
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    pinchStartRef.current = null;
    if (zoom > 1) {
      touchStartRef.current = null;
      return;
    }
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.t;
    touchStartRef.current = null;

    // Swipe down zum Schliessen
    if (dy > SWIPE_THRESHOLD * 2 && Math.abs(dx) < SWIPE_THRESHOLD) {
      onClose();
      return;
    }
    // Swipe links/rechts
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD && dt < 600) {
      if (dx > 0) prev();
      else next();
    }
  }

  if (!open || images.length === 0) return null;

  const current = images[idx];
  const src = srcCache[current.id];

  return (
    <div
      className="fixed inset-0 z-[95] bg-black flex items-center justify-center select-none"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Top-Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent text-white safe-area-top">
        <div className="text-sm tabular-nums opacity-80">
          {idx + 1} / {images.length}
        </div>
        <div className="flex items-center gap-2">
          {onDownload && (
            <button
              onClick={() => onDownload(current)}
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20"
              aria-label="Herunterladen"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation Buttons (Desktop) */}
      {idx > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="hidden sm:flex absolute left-4 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur"
          aria-label="Vorheriges Bild"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {idx < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="hidden sm:flex absolute right-4 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur"
          aria-label="Nächstes Bild"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image container */}
      <div
        className="w-full h-full flex items-center justify-center touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {loading || !src ? (
          <Loader2 className="h-10 w-10 text-white/60 animate-spin" />
        ) : (
          <img
            src={src}
            alt={current.alt ?? ''}
            draggable={false}
            className="max-w-full max-h-full object-contain transition-transform duration-150"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center',
            }}
          />
        )}
      </div>

      {/* Caption + Thumbnails */}
      {current.caption && (
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/60 to-transparent text-white text-sm text-center safe-area-bottom">
          {current.caption}
        </div>
      )}

      {/* Zoom-Hint (Mobile + zoomed) */}
      {zoom > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70 bg-white/10 backdrop-blur rounded-full px-3 py-1 sm:hidden">
          Doppel-Tippen zum Zurücksetzen
        </div>
      )}

      {/* Page-Indicator (Mobile) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 sm:hidden flex gap-1 safe-area-bottom">
        {images.length > 1 && images.length <= 8 && images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setIdx(i); }}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
            }`}
            aria-label={`Bild ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function touchDistance(a: React.Touch, b: React.Touch): number {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
