import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://adzeokkmrnzhresrtejs.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkemVva2ttcm56aHJlc3J0ZWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Nzg0MDksImV4cCI6MjA5MTI1NDQwOX0.jiSSyu1ZDMK779lz9sORaPysCLVftojrZIwHN67j66E';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload a file to Supabase Storage using the official JS client.
 * Returns the permanent public URL for the uploaded file.
 */
export async function uploadToSupabase(
  file: File,
  path: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  if (!path || path.includes('undefined') || path.includes('null')) {
    throw new Error('Ungueltiger Upload-Pfad. Bitte logge dich erneut ein.');
  }

  // Use Supabase JS client for upload — handles auth, content-type, etc.
  const { data, error } = await supabase.storage
    .from('creator-uploads')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error(`Upload fehlgeschlagen: ${error.message}`);
  }

  // Signal 100% progress
  onProgress(100);

  // Build public URL
  const { data: urlData } = supabase.storage
    .from('creator-uploads')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
