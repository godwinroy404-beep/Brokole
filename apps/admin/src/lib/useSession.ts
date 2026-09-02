import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isStaffRole, type AppRole, type Permission, type Profile } from '@brokole/domain';
import { supabase, isSupabaseConfigured } from './supabase';

export interface AdminSession {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  permissions: Set<Permission>;
  can: (p: Permission) => boolean;
  signOut: () => Promise<void>;
  signInDemo: (role?: AppRole, email?: string) => void;
  isDemoMode: boolean;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  owner: [
    'menu.read', 'menu.write', 'orders.read.all', 'orders.update.status',
    'inventory.read', 'inventory.write', 'vendors.read', 'vendors.write',
    'customers.read', 'finance.read', 'staff.manage', 'audit.read',
  ],
  store_manager: [
    'menu.read', 'menu.write', 'orders.read.all', 'orders.update.status',
    'inventory.read', 'inventory.write', 'vendors.read', 'customers.read',
  ],
  kitchen_staff: ['orders.read.all', 'orders.update.status', 'menu.read'],
  delivery_rider: ['orders.read.all', 'orders.update.status'],
  dietitian: ['menu.read', 'menu.write'],
  inventory_manager: ['inventory.read', 'inventory.write', 'vendors.read'],
  accountant: ['finance.read', 'orders.read.all'],
  customer: [],
};

export function useSession(): AdminSession {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
  const [isDemoMode, setIsDemoMode] = useState(!isSupabaseConfigured);

  const signInDemo = useCallback((role: AppRole = 'owner', email = 'admin@brokole.com') => {
    const demoProfile: Profile = {
      id: 'demo-owner-id',
      role,
      full_name: role === 'owner' ? 'Brokole Owner' : role === 'kitchen_staff' ? 'Kitchen Lead' : 'Store Manager',
      email,
      phone: '+91 98765 43210',
      is_active: true,
    };
    const perms = new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.owner);
    const mockSession = { user: { id: demoProfile.id, email: demoProfile.email } } as unknown as Session;

    localStorage.setItem('brokole_demo_session', JSON.stringify({ profile: demoProfile, role }));
    setProfile(demoProfile);
    setSession(mockSession);
    setPermissions(perms);
    setIsDemoMode(true);
    setLoading(false);
  }, []);

  const load = useCallback(async (s: Session | null) => {
    // 1. Check local demo session first
    const savedDemo = localStorage.getItem('brokole_demo_session');
    if (savedDemo) {
      try {
        const parsed = JSON.parse(savedDemo);
        if (parsed.profile) {
          const role = (parsed.role || 'owner') as AppRole;
          setProfile(parsed.profile);
          setSession({ user: { id: parsed.profile.id, email: parsed.profile.email } } as unknown as Session);
          setPermissions(new Set(DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.owner));
          setIsDemoMode(true);
          setLoading(false);
          return;
        }
      } catch (e) {
        localStorage.removeItem('brokole_demo_session');
      }
    }

    // 2. If Supabase is not configured, auto-initialize demo mode state
    if (!isSupabaseConfigured) {
      setSession(null);
      setProfile(null);
      setPermissions(new Set());
      setIsDemoMode(true);
      setLoading(false);
      return;
    }

    setSession(s);

    if (!s) {
      setProfile(null);
      setPermissions(new Set());
      setLoading(false);
      return;
    }

    try {
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, email, phone, is_active')
        .eq('id', s.user.id)
        .single();

      if (error || !prof || !prof.is_active || !isStaffRole(prof.role)) {
        await supabase.auth.signOut();
        setProfile(null);
        setPermissions(new Set());
        setSession(null);
        setLoading(false);
        return;
      }

      const { data: perms } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role', prof.role as AppRole);

      setProfile(prof as Profile);
      setPermissions(new Set((perms ?? []).map((p) => p.permission_key as Permission)));
      setIsDemoMode(false);
      setLoading(false);
    } catch (e) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const savedDemo = localStorage.getItem('brokole_demo_session');
    if (savedDemo || !isSupabaseConfigured) {
      void load(null);
      return;
    }

    supabase.auth.getSession().then(({ data }) => { if (alive) void load(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (alive) void load(s); });
    return () => { alive = false; sub?.subscription.unsubscribe(); };
  }, [load]);

  const signOut = async () => {
    localStorage.removeItem('brokole_demo_session');
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // ignore
      }
    }
    setProfile(null);
    setSession(null);
    setPermissions(new Set());
  };

  return {
    loading,
    session,
    profile,
    permissions,
    can: (p: Permission) => permissions.has(p),
    signOut,
    signInDemo,
    isDemoMode,
  };
}
