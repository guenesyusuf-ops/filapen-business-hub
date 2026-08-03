import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/passwords${path}`, { headers: headers(), ...init });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface PasswordCategory {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sortOrder: number;
}

export interface PasswordEntryListItem {
  id: string;
  title: string;
  url: string | null;
  username: string | null;
  faviconUrl: string | null;
  passwordStrength: number | null;
  passwordUpdatedAt: string;
  lastUsedAt: string | null;
  hasTotp: boolean;
  hasNotes: boolean;
  attachmentCount: number;
  category: { id: string; name: string; color: string; icon: string | null } | null;
  createdBy: { id: string; name: string | null; email: string };
  sharedWith: Array<{ id: string; name: string | null; email: string; permission: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordEntryCreate {
  title: string;
  url?: string | null;
  username?: string | null;
  password: string;
  notes?: string | null;
  totpSeed?: string | null;
  categoryId?: string | null;
  faviconUrl?: string | null;
  sharedWithUserIds?: string[];
}

export const passwordsApi = {
  // Kategorien
  listCategories: () => call<PasswordCategory[]>('/categories'),
  createCategory: (data: { name: string; color?: string; icon?: string | null }) =>
    call<PasswordCategory>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: { name?: string; color?: string; icon?: string | null; sortOrder?: number }) =>
    call<PasswordCategory>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    call<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' }),

  // Entries
  list: (params?: { search?: string; categoryId?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.categoryId) q.set('categoryId', params.categoryId);
    const qs = q.toString();
    return call<PasswordEntryListItem[]>(qs ? `?${qs}` : '');
  },
  create: (data: PasswordEntryCreate) =>
    call<{ id: string }>('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<PasswordEntryCreate>) =>
    call<{ ok: boolean }>(`/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => call<{ ok: boolean }>(`/${id}`, { method: 'DELETE' }),

  reveal: (id: string) =>
    call<{ password: string; totpSeed: string | null; notes: string | null }>(
      `/${id}/reveal`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  setAccess: (id: string, userIds: string[]) =>
    call<{ added: number; removed: number }>(
      `/${id}/access`,
      { method: 'POST', body: JSON.stringify({ userIds }) },
    ),

  audit: (params?: { entryId?: string; userId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.entryId) q.set('entryId', params.entryId);
    if (params?.userId) q.set('userId', params.userId);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return call<any[]>(`/audit/list${qs ? `?${qs}` : ''}`);
  },

  health: () =>
    call<{ total: number; weak: number; old: number; neverUsed: number; averageStrength: number }>(
      '/health/summary',
    ),

  // Team + Bulk-Sharing
  team: () =>
    call<Array<{ id: string; name: string | null; email: string; avatarUrl: string | null; role: string }>>(
      '/team/users',
    ),

  bulkGrant: (data: { entryIds: string[]; userIds: string[] }) =>
    call<{ granted: number; entries: number; users: number }>(
      '/bulk/grant',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  bulkRevoke: (data: { targetUserId: string; entryIds?: string[] }) =>
    call<{ removed: number }>('/bulk/revoke', { method: 'POST', body: JSON.stringify(data) }),
};

// Wandelt eine URL in ein Favicon-URL (Google-Service). Fallback: null.
export function faviconFor(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?sz=64&domain=${parsed.hostname}`;
  } catch {
    return null;
  }
}

// Passwort-Generator: 20 Zeichen mit gemischtem Charset.
export function generatePassword(
  length = 20,
  opts?: { upper?: boolean; lower?: boolean; digits?: boolean; symbols?: boolean },
): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()_+-=[]{}?';
  let charset = '';
  if (opts?.upper !== false) charset += upper;
  if (opts?.lower !== false) charset += lower;
  if (opts?.digits !== false) charset += digits;
  if (opts?.symbols !== false) charset += symbols;
  if (!charset) charset = lower + digits;
  const arr = new Uint32Array(length);
  (globalThis.crypto || (window as any).crypto).getRandomValues(arr);
  let out = '';
  for (let i = 0; i < length; i++) out += charset[arr[i] % charset.length];
  return out;
}

// ---------------------------------------------------------------------------
// TOTP — RFC 6238, HMAC-SHA1, 6-stelliger Code, 30s Schritte
// Verwendet Web-Crypto (nativ im Browser). Base32-Seed dekodieren.
// ---------------------------------------------------------------------------
function base32Decode(base32: string): Uint8Array | null {
  const s = base32.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
  if (!/^[A-Z2-7]+$/.test(s)) return null;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export async function totpCode(seed: string, timeStep = 30, digits = 6): Promise<string | null> {
  const key = base32Decode(seed);
  if (!key || key.length === 0) return null;
  try {
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(4, counter, false);
    // Explizit als ArrayBuffer casten (TS/DOM-Typings sind hier zickig).
    const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign'],
    );
    const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, buf));
    const offset = hmac[hmac.length - 1] & 0x0f;
    const bin =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    const code = (bin % Math.pow(10, digits)).toString().padStart(digits, '0');
    return code;
  } catch {
    return null;
  }
}

/** Sekunden bis zum naechsten Schritt (fuer Countdown-Balken). */
export function totpSecondsRemaining(timeStep = 30): number {
  return timeStep - (Math.floor(Date.now() / 1000) % timeStep);
}

// ---------------------------------------------------------------------------
// HaveIBeenPwned Check (k-anonymity)
// Wir schicken nur die ersten 5 Zeichen des SHA-1-Hashes an api.pwnedpasswords.com.
// HIBP liefert alle Hashes die mit diesem Praefix beginnen zurueck, wir suchen
// den vollen Hash lokal. Das eigentliche Passwort verlaesst NIEMALS den Browser.
// ---------------------------------------------------------------------------
export async function checkPwned(password: string): Promise<number | null> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuf = await crypto.subtle.digest('SHA-1', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const hex = hashArr.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hex.slice(0, 5);
    const suffix = hex.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    for (const line of text.split(/\r?\n/)) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix === suffix) return parseInt(countStr, 10);
    }
    return 0;
  } catch {
    return null;
  }
}
