import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  status: string;
  orgId: string;
  menuPermissions?: string[];
  mustChangePassword?: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  /** Whether the user account is active and fully approved */
  get isActive(): boolean;
  /** Whether the user account is pending admin approval */
  get isPending(): boolean;
  /** Whether the user account was rejected */
  get isRejected(): boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      get isActive() {
        return get().user?.status === 'active';
      },
      get isPending() {
        return get().user?.status === 'pending';
      },
      get isRejected() {
        return get().user?.status === 'rejected';
      },
    }),
    {
      name: 'filapen-auth',
    },
  ),
);

/**
 * Get authorization headers for API calls.
 * Returns an empty object if not authenticated.
 *
 * IMPORTANT: zustand/persist hydrates asynchronously on the client. When a user
 * directly navigates to a route that immediately triggers a fetch (e.g. /shipping/orders),
 * the store can still be empty even though the token is in localStorage. That used to
 * cause sporadic "No token" errors that disappeared after switching menus and back.
 * To avoid that, we read localStorage directly as a fallback.
 */
export function getAuthHeaders(): Record<string, string> {
  let token = useAuthStore.getState().token;
  if (!token && typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('filapen-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        token = parsed?.state?.token ?? null;
      }
    } catch {
      // corrupted storage — fall through
    }
  }
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
