import { API_URL } from './api';
import { getAuthHeaders } from '@/stores/auth';

const headers = () => ({ 'Content-Type': 'application/json', ...getAuthHeaders() });

async function call<T = any>(path: string, init?: RequestInit, withAuth = true): Promise<T> {
  const res = await fetch(`${API_URL}/api/screen-share${path}`, {
    headers: withAuth ? headers() : { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface ScreenShareSession {
  id: string;
  orgId: string;
  hostUserId: string;
  livekitRoomId: string;
  sessionName: string | null;
  audioEnabled: boolean;
  voiceEnabled: boolean;
  isPublic: boolean;
  publicToken: string | null;
  publicExpiresAt: string | null;
  status: 'active' | 'ended';
  startedAt: string;
  endedAt: string | null;
  participants?: ScreenShareParticipant[];
}

export interface ScreenShareParticipant {
  id: string;
  sessionId?: string;
  userId: string | null;
  guestName: string | null;
  role: 'host' | 'viewer';
  status: 'invited' | 'joined' | 'declined' | 'left';
  invitedAt?: string;
  joinedAt?: string | null;
  leftAt?: string | null;
}

export interface StartSessionResponse {
  session: ScreenShareSession;
  livekitToken: string;
  livekitUrl: string;
}

export interface JoinSessionResponse {
  session: ScreenShareSession;
  livekitToken: string;
  livekitUrl: string;
}

export interface PublicLinkResponse {
  token: string;
  passwordRequired: boolean;
  expiresAt: string;
}

export interface GuestJoinResponse {
  sessionId: string;
  participantId: string;
  livekitToken: string;
  livekitUrl: string;
  sessionName: string | null;
}

export const screenShareApi = {
  start: (data: { sessionName?: string; audioEnabled?: boolean; voiceEnabled?: boolean; invitedUserIds?: string[] }) =>
    call<StartSessionResponse>('/start', { method: 'POST', body: JSON.stringify(data) }),

  end: (id: string) =>
    call<ScreenShareSession>(`/${id}/end`, { method: 'POST' }),

  join: (id: string) =>
    call<JoinSessionResponse>(`/${id}/join`, { method: 'POST' }),

  decline: (id: string) =>
    call<{ ok: boolean }>(`/${id}/decline`, { method: 'POST' }),

  leave: (id: string) =>
    call<{ ok: boolean }>(`/${id}/leave`, { method: 'POST' }),

  listActive: () => call<ScreenShareSession[]>('/active'),
  listHistory: () => call<ScreenShareSession[]>('/history'),
  get: (id: string) => call<ScreenShareSession>(`/${id}`),

  createPublicLink: (id: string, password?: string) =>
    call<PublicLinkResponse>(`/${id}/public-link`, { method: 'POST', body: JSON.stringify({ password }) }),

  revokePublicLink: (id: string) =>
    call<ScreenShareSession>(`/${id}/public-link/revoke`, { method: 'POST' }),

  /** Public — kein Auth-Header */
  joinAsGuest: (token: string, name: string, password?: string) =>
    call<GuestJoinResponse>('/public/join',
      { method: 'POST', body: JSON.stringify({ token, name, password }) },
      false),
};
