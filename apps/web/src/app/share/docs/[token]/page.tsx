'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Folder, FileText, Image as ImageIcon, Video, File as FileIcon,
  Download, Loader2, AlertCircle, ChevronRight, Home, Calendar, Clock,
} from 'lucide-react';
import { API_URL } from '@/lib/api';

interface ShareFile {
  id: string;
  name: string;
  size: number | null;
  type: string | null;
  mimeType: string | null;
  createdAt: string;
}
interface FolderNode {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  files: ShareFile[];
  folders: FolderNode[];
}
interface ShareInfo {
  folderName: string;
  expiresAt: string | null;
  createdAt: string;
}
interface ShareResponse {
  shareInfo: ShareInfo;
  tree: FolderNode;
}

type ErrorState =
  | { kind: 'notfound' }
  | { kind: 'expired'; until: string }
  | { kind: 'revoked' }
  | { kind: 'unknown'; message: string };

function fmtSize(b: number | null): string {
  if (b === null || b === undefined) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function getFileIcon(t: string | null) {
  switch (t) {
    case 'image': return <ImageIcon className="h-4 w-4 text-orange-500" />;
    case 'video': return <Video className="h-4 w-4 text-amber-500" />;
    case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
    case 'document': return <FileText className="h-4 w-4 text-blue-500" />;
    case 'spreadsheet': return <FileText className="h-4 w-4 text-emerald-500" />;
    default: return <FileIcon className="h-4 w-4 text-gray-400" />;
  }
}

export default function PublicDocSharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<ShareResponse | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [path, setPath] = useState<FolderNode[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/share/docs/${token}`);
        if (!active) return;
        if (res.status === 404) { setError({ kind: 'notfound' }); return; }
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          const code = body?.message?.code ?? body?.code;
          const msg = body?.message?.message ?? body?.message;
          if (code === 'expired') setError({ kind: 'expired', until: msg ?? '' });
          else if (code === 'revoked') setError({ kind: 'revoked' });
          else setError({ kind: 'unknown', message: msg ?? 'Zugriff verweigert' });
          return;
        }
        if (!res.ok) { setError({ kind: 'unknown', message: `HTTP ${res.status}` }); return; }
        const json: ShareResponse = await res.json();
        setData(json);
        setPath([json.tree]);
      } catch (err: any) {
        if (!active) return;
        setError({ kind: 'unknown', message: err?.message ?? 'Netzwerkfehler' });
      }
    })();
    return () => { active = false; };
  }, [token]);

  if (error) return <ErrorView error={error} />;
  if (!data) return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );

  const current = path[path.length - 1];

  function openSubFolder(folder: FolderNode) { setPath((p) => [...p, folder]); }
  function navigateToIndex(i: number) { setPath((p) => p.slice(0, i + 1)); }

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Geteilter Ordner</p>
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 truncate">{data.shareInfo.folderName}</h1>
            </div>
            <div className="inline-flex h-10 w-10 rounded-xl bg-indigo-50 items-center justify-center flex-shrink-0">
              <Folder className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Erstellt: {fmtDate(data.shareInfo.createdAt)}</span>
            {data.shareInfo.expiresAt && (
              <span className="inline-flex items-center gap-1 text-amber-700"><Clock className="h-3 w-3" /> Gueltig bis: {fmtDate(data.shareInfo.expiresAt)}</span>
            )}
            {!data.shareInfo.expiresAt && (
              <span className="inline-flex items-center gap-1 text-emerald-700"><Clock className="h-3 w-3" /> Unbefristet</span>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        {path.length > 1 && (
          <div className="mb-3 flex items-center flex-wrap gap-1 text-xs">
            {path.map((node, i) => (
              <div key={node.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                <button
                  onClick={() => navigateToIndex(i)}
                  className={
                    i === path.length - 1
                      ? 'text-slate-900 font-medium'
                      : 'text-slate-500 hover:text-slate-800'
                  }
                >
                  {i === 0 ? <Home className="h-3.5 w-3.5 inline" /> : node.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {current.folders.length === 0 && current.files.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Folder className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Dieser Ordner ist leer.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {current.folders.map((sub) => (
                <li key={sub.id}>
                  <button
                    onClick={() => openSubFolder(sub)}
                    className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 text-left"
                  >
                    <Folder className="h-5 w-5 flex-shrink-0" style={{ color: sub.color || '#6366f1' }} fill={sub.color || '#6366f1'} fillOpacity={0.15} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{sub.name}</p>
                      <p className="text-[11px] text-slate-500">{sub.folders.length} Ordner · {sub.files.length} Dateien</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </button>
                </li>
              ))}
              {current.files.map((file) => (
                <li key={file.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                  <div className="flex-shrink-0">{getFileIcon(file.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                    <p className="text-[11px] text-slate-500">{fmtSize(file.size)} · {fmtDate(file.createdAt)}</p>
                  </div>
                  <a
                    href={`${API_URL}/api/share/docs/${token}/files/${file.id}/download`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-white px-3 py-1.5 text-xs font-medium"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400 mt-6">
          Geteilt ueber Filapen Business Hub
        </p>
      </div>
    </div>
  );
}

function ErrorView({ error }: { error: ErrorState }) {
  const meta = {
    notfound: { title: 'Link unbekannt', text: 'Dieser Link existiert nicht oder wurde nie erstellt.', color: 'slate' },
    expired:  { title: 'Link abgelaufen', text: 'Die Gueltigkeit dieses geteilten Ordners ist abgelaufen.', color: 'amber' },
    revoked:  { title: 'Link widerrufen', text: 'Der Eigentuemer hat diesen Link deaktiviert.', color: 'red' },
    unknown:  { title: 'Fehler beim Laden', text: 'Bitte versuche es spaeter erneut.', color: 'red' },
  }[error.kind];

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 max-w-md w-full p-8 text-center">
        <div className={`inline-flex h-14 w-14 rounded-2xl items-center justify-center mb-4 ${
          meta.color === 'amber' ? 'bg-amber-100 text-amber-600' :
          meta.color === 'red' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
        }`}>
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900 mb-1">{meta.title}</h1>
        <p className="text-sm text-slate-600">{meta.text}</p>
        {error.kind === 'unknown' && (
          <p className="text-[10px] text-slate-400 mt-2">Details: {error.message}</p>
        )}
      </div>
    </div>
  );
}
