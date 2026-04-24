'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Upload, Download, Eye, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://filapenapi-production.up.railway.app';

interface Invoice {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  createdAt: string;
  status: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CreatorInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const creatorId = typeof window !== 'undefined'
    ? JSON.parse(sessionStorage.getItem('creator_data') || '{}')?.id
    : null;

  const fetchInvoices = useCallback(async () => {
    if (!creatorId) return;
    try {
      const res = await fetch(`${API_URL}/api/creator-uploads?creatorId=${creatorId}&tab=rechnungen`);
      if (res.ok) {
        const data = await res.json();
        setInvoices((data || []).map((u: any) => ({
          id: u.id,
          fileName: u.fileName,
          fileUrl: u.fileUrl,
          fileSize: Number(u.fileSize || 0),
          createdAt: u.createdAt,
          status: u.liveStatus || 'hochgeladen',
        })));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [creatorId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  async function handleUpload(file: File) {
    if (!file.type.includes('pdf')) {
      setError('Bitte nur PDF-Dateien hochladen');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Datei zu groß (max 20 MB)');
      return;
    }
    if (!creatorId) {
      setError('Creator nicht geladen. Bitte erneut einloggen.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadSuccess(false);

    try {
      // Step 1: Upload file to R2 storage
      const uploadResult = await uploadFile(file, () => {});

      // Step 2: Create the upload record via API (JSON, not FormData)
      const res = await fetch(`${API_URL}/api/creator-uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          fileName: file.name,
          fileUrl: uploadResult.url,
          fileType: 'file',
          mimeType: file.type,
          fileSize: file.size,
          tab: 'rechnungen',
          category: 'rechnungen',
          label: `Rechnung ${new Date().toLocaleDateString('de-DE')}`,
          storageKey: uploadResult.key || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Upload fehlgeschlagen');
      }

      setUploadSuccess(true);
      fetchInvoices();
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <div>
        <h1 className="font-display-serif text-2xl sm:text-3xl font-medium tracking-tight text-gray-900 dark:text-white leading-[1.1]">Rechnung hochladen</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Lade deine Rechnungen als PDF hoch. Sie werden automatisch an das Team weitergeleitet.
        </p>
      </div>

      {/* Upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        className={cn(
          'rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all',
          uploading
            ? 'border-violet-400 bg-violet-50'
            : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50/30',
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
            <p className="text-sm font-medium text-violet-600">Wird hochgeladen...</p>
          </div>
        ) : uploadSuccess ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-600">Rechnung erfolgreich hochgeladen!</p>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Klicke hier oder ziehe eine PDF-Datei</p>
            <p className="text-xs text-gray-400 mt-1">Nur PDF-Dateien, max 20 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Invoice list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-10 w-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Noch keine Rechnungen hochgeladen</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
              <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{inv.fileName}</p>
                <p className="text-xs text-gray-400">
                  {formatSize(inv.fileSize)} · {new Date(inv.createdAt).toLocaleDateString('de-DE')}
                </p>
              </div>
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                inv.status === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
              )}>
                {inv.status === 'live' ? 'Geprüft' : 'Hochgeladen'}
              </span>
              <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded text-gray-400 hover:text-violet-600" title="Ansehen">
                <Eye className="h-4 w-4" />
              </a>
              <a href={inv.fileUrl} download={inv.fileName} className="p-1.5 rounded text-gray-400 hover:text-violet-600" title="Herunterladen">
                <Download className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
