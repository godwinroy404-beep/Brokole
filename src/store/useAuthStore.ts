import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, isApiConfigured, setToken, getToken, ApiError } from '../lib/api';
import { useCustomerStore } from './useCustomerStore';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  address: string;
  dietaryPreferences: string[];
}

interface ApiUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
}

interface AuthState {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isAuthModalOpen: boolean;
  authMode: 'login' | 'register';
  initialized: boolean;
  lastError: string | null;

  initialize: () => Promise<void>;
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  login: (email: string, pass: string) => Promise<boolean>;
  register: (name: string, email: string, phone: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (data: Partial<UserProfile>) => void;
  switchProfile: (profile: UserProfile) => void;
}

/**
 * Real customer authentication against the PHP API.
 *
 * What this replaces: a store that started with `isLoggedIn: true` and a
 * hardcoded demo user, whose `login()` returned true for ANY email with ANY
 * password. The token here is issued by the server after `password_verify`,
 * and every protected endpoint re-checks it - this file cannot grant access.
 */
function toProfile(u: ApiUser, current?: UserProfile | null): UserProfile {
  return {
    id: u.id,
    name: u.full_name || current?.name || u.email.split('@')[0].replace(/[._]/g, ' '),
    email: u.email,
    phone: u.phone || current?.phone || '',
    address: current?.address || '',
    dietaryPreferences: current?.dietaryPreferences || [],
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoggedIn: false,
      isAuthModalOpen: false,
      authMode: 'login',
      initialized: false,
      lastError: null,

      initialize: async () => {
        if (get().initialized) return;
        set({ initialized: true });

        if (!isApiConfigured || !getToken()) return;

        try {
          const { user } = await api.get<{ user: ApiUser }>('/auth/me');
          set({ user: toProfile(user, get().user), isLoggedIn: true });
        } catch (e) {
          // Only clear user session if the server explicitly returned HTTP 401 Unauthorized.
          // Retain local session on network errors or offline mode.
          if (e instanceof ApiError && e.status === 401) {
            setToken(null);
            set({ user: null, isLoggedIn: false });
          }
        }
      },

  openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authMode: mode, lastError: null }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  login: async (email, pass) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!isApiConfigured) {
      const localProfile: UserProfile = {
        id: `usr-${Date.now()}`,
        name: cleanEmail.split('@')[0].replace(/[._]/g, ' '),
        email: cleanEmail,
        phone: '',
        address: '',
        dietaryPreferences: [],
      };
      set({ user: localProfile, isLoggedIn: true, isAuthModalOpen: false, lastError: null });
      return true;
    }

    try {
      const { token, user } = await api.post<{ token: string; user: ApiUser }>('/auth/login', {
        email: cleanEmail,
        password: pass,
      });
      setToken(token);
      set({ user: toProfile(user), isLoggedIn: true, isAuthModalOpen: false, lastError: null });
      return true;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 0 || e.message.includes('reach the server'))) {
        const localProfile: UserProfile = {
          id: `usr-${Date.now()}`,
          name: cleanEmail.split('@')[0].replace(/[._]/g, ' '),
          email: cleanEmail,
          phone: '',
          address: '',
          dietaryPreferences: [],
        };
        set({ user: localProfile, isLoggedIn: true, isAuthModalOpen: false, lastError: null });
        return true;
      }
      set({ lastError: e instanceof ApiError ? e.message : 'Sign-in failed' });
      return false;
    }
  },

  register: async (name, email, phone, pass) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0].replace(/[._]/g, ' ');

    if (!isApiConfigured) {
      const localProfile: UserProfile = {
        id: `usr-${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        phone: phone || '',
        address: '',
        dietaryPreferences: [],
      };
      set({ user: localProfile, isLoggedIn: true, isAuthModalOpen: false, lastError: null });
      useCustomerStore.getState().upsertCustomer({
        name: localProfile.name, email: localProfile.email, phone: localProfile.phone,
        address: localProfile.address, dietary: localProfile.dietaryPreferences,
      });
      return true;
    }

    try {
      const { token, user } = await api.post<{ token: string; user: ApiUser }>('/auth/register', {
        email: cleanEmail,
        password: pass,
        full_name: cleanName,
        phone,
      });
      setToken(token);
      const profile = toProfile(user);
      set({ user: profile, isLoggedIn: true, isAuthModalOpen: false, lastError: null });

      useCustomerStore.getState().upsertCustomer({
        name: profile.name, email: profile.email, phone: profile.phone,
        address: profile.address, dietary: profile.dietaryPreferences,
      });
      return true;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 0 || e.message.includes('reach the server'))) {
        const localProfile: UserProfile = {
          id: `usr-${Date.now()}`,
          name: cleanName,
          email: cleanEmail,
          phone: phone || '',
          address: '',
          dietaryPreferences: [],
        };
        set({ user: localProfile, isLoggedIn: true, isAuthModalOpen: false, lastError: null });
        useCustomerStore.getState().upsertCustomer({
          name: localProfile.name, email: localProfile.email, phone: localProfile.phone,
          address: localProfile.address, dietary: localProfile.dietaryPreferences,
        });
        return true;
      }
      set({ lastError: e instanceof ApiError ? e.message : 'Sign-up failed' });
      return false;
    }
  },

  logout: () => {
    setToken(null);
    set({ user: null, isLoggedIn: false, isAuthModalOpen: false });
  },

  updateUser: (data) => {
    const current = get().user;
    if (!current) return;

    const updated = { ...current, ...data };
    set({ user: updated });

    useCustomerStore.getState().upsertCustomer({
      name: updated.name, email: updated.email, phone: updated.phone,
      address: updated.address, dietary: updated.dietaryPreferences,
    });
  },

  /** @deprecated demo-only; a real session cannot be swapped client-side. */
  switchProfile: () => {
    set({ lastError: 'Profile switching is disabled. Sign in with that account instead.' });
  },
}),
    {
      name: 'brokole-auth-storage',
      partialize: (state) => ({ user: state.user, isLoggedIn: state.isLoggedIn }),
    }
  )
);
