import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  orgId: string;
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
 */
export function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
