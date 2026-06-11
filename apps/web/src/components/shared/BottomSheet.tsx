'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Optional Footer-Slot (z.B. fuer fixe Action-Buttons). */
  footer?: React.ReactNode;
  /** Max Hoehe als prozentualer Anteil des Viewports. Default 90dvh. */
  maxHeight?: string;
  /** Wenn true, ist Drag-to-Dismiss aktiv (nur Mobile). */
  draggable?: boolean;
  /** Auf Desktop: zentrierter Modal statt Bottom-Sheet. */
  desktopMode?: 'sheet' | 'centered';
  children: React.ReactNode;
  /** Fuer Tests/Storybook: Animation deaktivieren. */
  disableAnimation?: boolean;
  /** Zusaetzliche Klassen am Sheet-Container. */
  className?: string;
}

const DRAG_THRESHOLD = 80; // px nach unten ziehen um zu schliessen
const DRAG_DAMP = 0.6;     // wie stark der Drag verzoegert ist

/**
 * BottomSheet — mobile-natives Bottom-Sheet-Modal.
 * - Mobile (<sm): slidet von unten rein, Drag-to-Dismiss
 * - Desktop (sm+): zentrierter Modal (oder weiter als Sheet wenn explizit)
 * - ESC zum schliessen, Overlay-Klick zum schliessen
 * - Body-Scroll-Lock waehrend offen
 */
export function BottomSheet({
  open, onClose, title, footer, maxHeight = '90dvh',
  draggable = true, desktopMode = 'centered',
  children, disableAnimation, className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Body-Scroll-Lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Drag-Handler — nur auf Touch
  function onPointerDown(e: React.PointerEvent) {
    if (!draggable) return;
    if (e.pointerType !== 'touch') return;
    // Nur an der Drag-Handle / Header beginnen
    const target = e.target as HTMLElement;
    if (!target.closest('[data-drag-handle]')) return;
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!isDraggingRef.current || startYRef.current == null) return;
    const dy = e.clientY - startYRef.current;
    if (dy > 0) setDragY(dy * DRAG_DAMP);
  }
  function onPointerUp() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startYRef.current = null;
    if (dragY > DRAG_THRESHOLD) {
      setDragY(0);
      onClose();
    } else {
      setDragY(0);
    }
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[80] flex justify-center',
        desktopMode === 'centered' ? 'items-end sm:items-center sm:p-4' : 'items-end',
      )}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'sheet-title' : undefined}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'relative z-[5] w-full bg-white dark:bg-[#0f1117] shadow-2xl border-t sm:border border-gray-200 dark:border-white/10 flex flex-col overflow-hidden touch-pan-y',
          'rounded-t-2xl',
          desktopMode === 'centered' && 'sm:rounded-2xl sm:max-w-lg sm:max-h-[92vh]',
          desktopMode === 'sheet' && 'sm:rounded-2xl sm:max-w-2xl',
          !disableAnimation && 'animate-slide-up sm:animate-none',
          className,
        )}
        style={{
          maxHeight: maxHeight,
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {/* Drag-Handle (Mobile only) */}
        <div
          data-drag-handle
          className="sm:hidden flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
        >
          <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-white/15" />
        </div>

        {/* Header */}
        {title && (
          <div data-drag-handle className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
            <h2 id="sheet-title" className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {title}
            </h2>
            <button onClick={onClose} className="p-2 -mr-2 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500" aria-label="Schließen">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-white/[0.02] mobile-safe-bottom px-5 py-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
