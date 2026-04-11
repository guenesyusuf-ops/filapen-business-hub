'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateCreator } from '@/hooks/creators/useCreators';

// ---------------------------------------------------------------------------
// AvatarUpload
// ---------------------------------------------------------------------------
//
// Data flow:
//   1. User picks an image file via hidden <input type="file" />
//   2. FileReader reads it as data URL
//   3. An Image element loads the data URL
//   4. The image is drawn onto a 256x256 canvas with a center-crop
//      (aspect ratio preserved, largest fitting square is taken)
//   5. canvas.toDataURL('image/jpeg', 0.8) produces a compact base64 string
//      (typically 30-80kb)
//   6. The base64 string is sent to the backend via PATCH/PUT
//      /api/creators/:id with body { avatarUrl: <dataUrl> }
//   7. On success the query cache is invalidated by useUpdateCreator
//      and the parent is notified via onSuccess()

const TARGET_SIZE = 256; // px — square avatar
const JPEG_QUALITY = 0.8;
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB raw input safety net

export interface AvatarUploadProps {
  creatorId: string;
  name: string;
  currentAvatarUrl?: string | null;
  size?: number; // displayed size in px
  onSuccess?: (newUrl: string) => void;
}

async function fileToResizedDataUrl(file: File): Promise<string> {
  // Step 1: read file as data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsDataURL(file);
  });

  // Step 2: load image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image load failed'));
    el.src = dataUrl;
  });

  // Step 3: draw on a square canvas with center-crop
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - srcSize) / 2;
  const sy = (img.naturalHeight - srcSize) / 2;

  // Fill background (avoids transparent edges when JPEG encoding)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, TARGET_SIZE, TARGET_SIZE);

  // Step 4: encode as JPEG data URL
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export function AvatarUpload({
  creatorId,
  name,
  currentAvatarUrl,
  size = 96,
  onSuccess,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const updateMutation = useUpdateCreator();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // reset input so the same file can be re-selected
      e.target.value = '';
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setError('Bitte eine Bilddatei ausw\u00e4hlen');
        return;
      }
      if (file.size > MAX_INPUT_BYTES) {
        setError('Bild ist zu gro\u00df (max 10 MB)');
        return;
      }

      setError(null);
      setUploading(true);

      try {
        const dataUrl = await fileToResizedDataUrl(file);
        setPreviewUrl(dataUrl);

        await new Promise<void>((resolve, reject) => {
          updateMutation.mutate(
            { id: creatorId, data: { avatarUrl: dataUrl } as any },
            {
              onSuccess: () => {
                onSuccess?.(dataUrl);
                resolve();
              },
              onError: (err) => reject(err),
            },
          );
        });
      } catch (err: any) {
        console.error('Avatar upload failed', err);
        setError(err?.message || 'Upload fehlgeschlagen');
        setPreviewUrl(null);
      } finally {
        setUploading(false);
      }
    },
    [creatorId, onSuccess, updateMutation],
  );

  const displayUrl = previewUrl || currentAvatarUrl || null;
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{ width: size, height: size }}
        className={cn(
          'group relative rounded-full overflow-hidden shrink-0',
          'bg-accent-creator-light dark:bg-accent-creator/20',
          'border border-gray-200 dark:border-white/10',
          'flex items-center justify-center',
          'focus:outline-none focus:ring-2 focus:ring-accent-creator/40',
          uploading ? 'cursor-wait' : 'cursor-pointer',
        )}
        title={'Profilbild \u00e4ndern'}
      >
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="font-bold text-accent-creator"
            style={{ fontSize: size * 0.4 }}
          >
            {initial}
          </span>
        )}

        {/* Hover overlay */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-1',
            'bg-black/50 text-white text-[10px] font-medium',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            uploading && 'opacity-100',
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{'Uploading\u2026'}</span>
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              <span>{'Bild \u00e4ndern'}</span>
            </>
          )}
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400 max-w-[200px]">
          {error}
        </p>
      )}
    </div>
  );
}

export default AvatarUpload;
