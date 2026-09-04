import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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
 * Real customer authentication.
 *
 * What this replaces: the previous store started with `isLoggedIn: true` and a
 * hardcoded demo user, and `login()` returned true for ANY email with ANY
 * password. The "mandatory auth check" at checkout was therefore decorative.
 *
 * Sessions now come from Supabase Auth. That matters beyond login: `place_order`
 * derives the customer from `auth.uid()`, and RLS decides which orders you can
 * read from the same JWT. Without a real session an order simply cannot be
 * placed — the database has nobody to attribute it to.
 */

const emptyProfile = (id: string, email: string): UserProfile => ({
  id,
  name: email.split('@')[0].replace(/[._]/g, ' '),
  email,
  phone: '',
  address: '',
  dietaryPreferences: [],
});

async function profileFromSession(userId: string, email: string): Promise<UserProfile> {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (!data) return emptyProfile(userId, email);

  return {
    id: data.id,
    name: data.full_name || email.split('@')[0].replace(/[._]/g, ' '),
    email: data.email || email,
    phone: data.phone || '',
    avatarUrl: data.avatar_url || undefined,
    address: '',
    dietaryPreferences: [],
  };
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoggedIn: false,
  isAuthModalOpen: false,
  authMode: 'login',
  initialized: false,
  lastError: null,

  initialize: async () => {
    if (get().initialized) return;
    set({ initialized: true });

    if (!isSupabaseConfigured) return;

    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const profile = await profileFromSession(data.session.user.id, data.session.user.email ?? '');
      set({ user: profile, isLoggedIn: true });
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await profileFromSession(session.user.id, session.user.email ?? '');
        set({ user: profile, isLoggedIn: true });
      } else {
        set({ user: null, isLoggedIn: false });
      }
    });
  },

  openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authMode: mode, lastError: null }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  login: async (email, pass) => {
    if (!isSupabaseConfigured) {
      set({ lastError: 'Sign-in is unavailable until the app is connected to its database.' });
      return false;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pass,
    });

    if (error || !data.user) {
      set({ lastError: error?.message ?? 'Sign-in failed' });
      return false;
    }

    const profile = await profileFromSession(data.user.id, data.user.email ?? email);
    set({ user: profile, isLoggedIn: true, isAuthModalOpen: false, lastError: null });
    return true;
  },

  register: async (name, email, phone, pass) => {
    if (!isSupabaseConfigured) {
      set({ lastError: 'Sign-up is unavailable until the app is connected to its database.' });
      return false;
    }

    // The role is NOT sent here. A database trigger assigns 'customer' and
    // ignores anything the client puts in this metadata.
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: pass,
      options: { data: { full_name: name, phone } },
    });

    if (error || !data.user) {
      set({ lastError: error?.message ?? 'Sign-up failed' });
      return false;
    }

    let currentUser = data.user;

    // If session wasn't returned by signUp (e.g. if Supabase project has email confirmation enabled in dashboard),
    // attempt to sign in immediately so user is automatically authenticated.
    if (!data.session) {
      const loginRes = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass,
      });
      if (loginRes.data?.user) {
        currentUser = loginRes.data.user;
      }
    }

    const profile: UserProfile = {
      id: currentUser.id,
      name: name || email.split('@')[0],
      email: currentUser.email ?? email,
      phone: phone || '',
      address: '',
      dietaryPreferences: [],
    };

    set({
      user: profile,
      isLoggedIn: true,
      isAuthModalOpen: false,
      lastError: null,
    });

    useCustomerStore.getState().upsertCustomer({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      dietary: profile.dietaryPreferences,
    });

    return true;
  },

  logout: () => {
    void supabase.auth.signOut();
    set({ user: null, isLoggedIn: false, isAuthModalOpen: false });
  },

  updateUser: (data) => {
    const current = get().user;
    if (!current) return;

    const updated = { ...current, ...data };
    set({ user: updated });

    if (isSupabaseConfigured) {
      // RLS allows a customer to update only their own row, and the role column
      // is reverted by a trigger even if it were sent.
      void supabase
        .from('profiles')
        .update({ full_name: updated.name, phone: updated.phone })
        .eq('id', updated.id);
    }

    useCustomerStore.getState().upsertCustomer({
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      address: updated.address,
      dietary: updated.dietaryPreferences,
    });
  },

  /** @deprecated demo-only profile switching; a real session cannot be swapped client-side. */
  switchProfile: (profile) => {
    if (isSupabaseConfigured) {
      set({ lastError: 'Profile switching is disabled. Sign in with that account instead.' });
      return;
    }
    set({ user: profile, isLoggedIn: true });
  },
}));
