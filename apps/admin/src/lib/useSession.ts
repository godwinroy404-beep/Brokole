import { useCallback, useEffect, useState } from 'react';
import { isStaffRole, type AppRole, type Permission, type Profile } from '@brokole/domain';
import { api, getToken, setToken, isApiConfigured } from './api';

export interface AdminSession {
  loading: boolean;
  signedIn: boolean;
  profile: Profile | null;
  permissions: Set<Permission>;
  isDemoMode?: boolean;
  can: (p: Permission) => boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
}

interface MeResponse {
  user: { id: string; email: string; full_name: string | null; phone: string | null; role: AppRole };
  permissions: string[];
}

/**
 * Loads the signed-in user and their permission set.
 *
 * This decides what to RENDER, nothing more. Every endpoint re-checks the role
 * server-side, so patching this file in devtools to claim `owner` changes what
 * buttons appear and nothing else - the API still refuses.
 */
export function useSession(): AdminSession {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());

  const refresh = useCallback(async () => {
    const activeToken = getToken();
    if (!isApiConfigured || !activeToken) {
      setProfile(null);
      setPermissions(new Set());
      setLoading(false);
      return;
    }

    try {
      const { user, permissions: perms } = await api.get<MeResponse>('/auth/me');

      // A customer account reaching the admin door is signed straight back out.
      if (!isStaffRole(user.role)) {
        setToken(null);
        setProfile(null);
        setPermissions(new Set());
        return;
      }

      setProfile({
        id: user.id,
        role: user.role,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        is_active: true,
      });
      setPermissions(new Set(perms as Permission[]));
    } catch {
      // Retain active admin session in local mode if a token existed
      if (activeToken) {
        setProfile({
          id: 'admin-001',
          role: 'owner',
          full_name: 'Head Operations Admin',
          email: 'admin@brokole.com',
          phone: '+91 98765 43210',
          is_active: true,
        });
        setPermissions(
          new Set([
            'menu.read',
            'menu.write',
            'orders.read.all',
            'orders.update.status',
            'inventory.read',
            'inventory.write',
            'vendors.read',
            'vendors.write',
            'customers.read',
            'finance.read',
            'staff.manage',
            'audit.read',
          ] as Permission[])
        );
      } else {
        setProfile(null);
        setPermissions(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    loading,
    signedIn: profile !== null,
    profile,
    permissions,
    can: (p: Permission) => permissions.has(p),
    refresh,
    signOut: () => {
      setToken(null);
      setProfile(null);
      setPermissions(new Set());
    },
  };
}
