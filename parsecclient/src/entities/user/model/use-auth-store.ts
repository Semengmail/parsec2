import { create } from 'zustand';

export type UserRole = 'user' | 'admin' | 'manager' | 'support';

export type AuthUser = {
  id: number;
  email: string;
  name?: string | null;
  company?: string | null;
  role?: UserRole[] | null;
  balance?: string;
  tariffId?: number | null;
  status?: 'active' | 'blocked';
  lastLoginAt?: string | Date | null;
  softId?: string | null;
  referralCode?: string;
};

type State = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
};

type Actions = {
  setUser: (u: AuthUser | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  logoutLocal: () => void;
};

export const useAuthStore = create<State & Actions>((set) => ({
  user: null,
  loading: false,
  error: null,
  setUser: (u) => set({ user: u }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  logoutLocal: () => set({ user: null }),
}));
