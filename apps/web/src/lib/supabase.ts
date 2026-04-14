import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://adzeokkmrnzhresrtejs.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkemVva2ttcm56aHJlc3J0ZWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzg0MDksImV4cCI6MjA5MTI1NDQwOX0.jiSSyu1ZDMK779lz9sORaPysCLVftojrZIwHN67j66E';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload a file to Cloudflare R2 via the backend API.
 * Uses XMLHttpRequest for real upload progress tracking.
 * Returns the response object with url, key, fileName, fileSize, mimeType.
 */
export async function uploadFile(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ url: string; key: string; fileName: string; fileSize: number; mimeType: string }> {
  const { API_URL } = await import('@/lib/api');

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Ungueltige Server-Antwort'));
        }
      } else {
        reject(new Error(`Upload fehlgeschlagen (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload fehlgeschlagen')));

    xhr.open('POST', `${API_URL}/api/uploads/file`);
    xhr.send(formData);
  });
}

/** @deprecated Use uploadFile instead. Kept for backwards compatibility. */
export const uploadToSupabase = async (
  file: File,
  _path: string,
  onProgress: (pct: number) => void,
): Promise<string> => {
  const result = await uploadFile(file, onProgress);
  return result.url;
};
