import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/send${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface SendItem {
  id: string;
  fileName: string;
  filePath?: string | null;
  mimeType?: string | null;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
}

export interface InboxTransfer {
  id: string;
  message: string | null;
  senderId: string;
  sender: { id: string; name: string | null; email: string; firstName: string | null; lastName: string | null; avatarUrl: string | null };
  createdAt: string;
  expiresAt: string | null;
  receivedAt: string | null;
  receiverRowId: string;
  items: SendItem[];
  totalSize: number;
  recipientCount: number;
}

export interface OutboxTransfer {
  id: string;
  message: string | null;
  createdAt: string;
  expiresAt: string | null;
  items: SendItem[];
  totalSize: number;
  recipients: Array<{
    recipientId: string;
    user: { id: string; name: string | null; email: string; firstName: string | null; lastName: string | null; avatarUrl: string | null };
    receivedAt: string | null;
  }>;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export const sendApi = {
  inbox: () => call<InboxTransfer[]>('/inbox'),
  outbox: () => call<OutboxTransfer[]>('/outbox'),

  /**
   * Upload mit Progress via XHR (fetch hat keinen progress event).
   * Liefert das angelegte Transfer-Objekt.
   */
  upload: (
    recipientIds: string[],
    files: File[],
    options: { message?: string; onProgress?: (p: UploadProgress) => void } = {},
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      // file paths fuer Ordner-Uploads (webkitRelativePath)
      const filePaths: string[] = [];
      for (const f of files) {
        fd.append('files', f, f.name);
        // @ts-ignore — Browser-API
        filePaths.push((f as any).webkitRelativePath || f.name);
      }
      fd.append('recipientIds', JSON.stringify(recipientIds));
      fd.append('filePaths', JSON.stringify(filePaths));
      if (options.message) fd.append('message', options.message);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/api/send/upload`);
      const auth = getAuthHeaders() as Record<string, string>;
      Object.entries(auth).forEach(([k, v]) => xhr.setRequestHeader(k, v));

      if (options.onProgress) {
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          options.onProgress!({
            loaded: e.loaded,
            total: e.total,
            percent: Math.round((e.loaded / e.total) * 100),
          });
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch { resolve(xhr.responseText); }
        } else {
          let msg = `HTTP ${xhr.status}`;
          try { const j = JSON.parse(xhr.responseText); msg = j.message || msg; } catch {}
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error('Netzwerk-Fehler'));
      xhr.send(fd);
    });
  },

  /** Datei herunterladen (Stream via API mit Auth) */
  downloadItem: async (itemId: string, fileName: string) => {
    const res = await fetch(`${API_URL}/api/send/items/${itemId}/file`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Download fehlgeschlagen: HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  markReceived: (id: string) => call(`/${id}/received`, { method: 'PATCH' }),
  revoke: (id: string) => call(`/${id}`, { method: 'DELETE' }),
  hide: (id: string) => call(`/${id}/hide`, { method: 'PATCH' }),
};

// ----------------------------------------------------------------------------
// Broadcast-Bridge: gleicher Pattern wie ScreenShare — OrgPresenceProvider
// registriert die Liveblocks-Broadcast-Funktion hier, SendModal kann sie
// nach erfolgreichem Upload aufrufen damit Empfaenger sofort ein Popup
// sehen.
// ----------------------------------------------------------------------------

export type FilapenSendReceivedEvent = {
  type: 'filapen-send-received';
  transferId: string;
  senderUserId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  recipientUserIds: string[];
  fileCount: number;
  totalSize: number;
  message: string | null;
};

const sendBroadcastRef: { fn: ((event: FilapenSendReceivedEvent) => void) | null } = { fn: null };

export function setSendBroadcastFn(fn: ((event: FilapenSendReceivedEvent) => void) | null) {
  sendBroadcastRef.fn = fn;
}

export function broadcastSendReceived(event: FilapenSendReceivedEvent) {
  sendBroadcastRef.fn?.(event);
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
