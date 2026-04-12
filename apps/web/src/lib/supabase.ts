import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://adzeokkmrnzhresrtejs.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkemVva2ttcm56aHJlc3J0ZWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzg0MDksImV4cCI6MjA5MTI1NDQwOX0.jiSSyu1ZDMK779lz9sORaPysCLVftojrZIwHN67j66E';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload a file to Supabase Storage with progress tracking via XMLHttpRequest.
 * Returns the permanent public URL for the uploaded file.
 */
export async function uploadToSupabase(
  file: File,
  path: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${supabaseUrl}/storage/v1/object/creator-uploads/${path}`;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/creator-uploads/${path}`;
        resolve(publicUrl);
      } else {
        const body = xhr.responseText || '';
        console.error('Supabase Storage Error:', xhr.status, body);
        reject(new Error(`Storage Upload fehlgeschlagen (${xhr.status}): ${body.slice(0, 200)}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload fehlgeschlagen')));

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${supabaseAnonKey}`);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.send(file);
  });
}
