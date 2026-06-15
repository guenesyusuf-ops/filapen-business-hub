/**
 * Public-API-Client fuer den Filapen-Backend.
 *
 * Es werden nur die /nfc/public/* Endpoints aufgerufen (kein Auth).
 * API-URL kommt aus NEXT_PUBLIC_API_URL (Build-Time-Env).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.filapen.com';

export interface ActivationFields {
  firstName?: string;
  lastName?: string;
  phone?: string;
  phone2?: string;
  notes?: string;
  street?: string;
  zip?: string;
  city?: string;
  email?: string;
  pin?: string;
  consent: boolean;
}

export interface PublicStatus {
  status: 'inactive' | 'active' | 'notfound';
  code?: string;
  data?: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    phone2: string | null;
    notes: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
    editEnabled: boolean;
  };
}

async function call<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/nfc${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || j.error || msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const nfcPublicApi = {
  /** Frontend ruft das beim Scan auf — Server entscheidet was rendert. */
  getStatus: (code: string) => call<PublicStatus>(`/public/${code}`),

  activate: (code: string, data: ActivationFields) =>
    call<{ ok: true }>(`/public/${code}/activate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  authenticate: (code: string, pin: string) =>
    call<{ ok: true; data: any }>(`/public/${code}/auth`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  updateData: (code: string, pin: string, data: ActivationFields) =>
    call<{ ok: true }>(`/public/${code}/edit`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, pin }),
    }),

  deleteData: (code: string, pin: string) =>
    call<{ ok: true }>(`/public/${code}/edit`, {
      method: 'DELETE',
      body: JSON.stringify({ pin }),
    }),
};
