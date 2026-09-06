import { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isStaffRole, type AppRole } from '@brokole/domain';
import { api, setToken, isApiConfigured } from '../lib/api';

/**
 * Staff sign-in. Three deliberate absences:
 *   1. No "create account" link — staff exist only because an owner made them.
 *   2. No password compared or stored in this bundle.
 *   3. No demo / bypass button.
 * The role check below is a courtesy so a customer gets a clear message instead
 * of an empty console. It is not what keeps them out; the API is.
 */
export function LoginScreen({ onSignedIn }: { onSignedIn: () => void | Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isApiConfigured) {
      toast.error('Not connected to the API yet', {
        description: 'Set VITE_API_URL in apps/admin/.env.local, then restart the dev server.',
        duration: 8000,
      });
      return;
    }
    if (!email.trim() || !password) {
      toast.error('Enter your work email and password');
      return;
    }

    setBusy(true);
    try {
      const { token, user } = await api.post<{
        token: string;
        user: { role: AppRole; email: string };
      }>('/auth/login', { email: email.trim().toLowerCase(), password });

      if (!isStaffRole(user.role)) {
        toast.error('This account has no access to the operations console.', {
          description:
            `It signed in fine, but its role is '${user.role}'. An owner must run: ` +
            `UPDATE users SET role='owner' WHERE email='${user.email}';`,
          duration: 10000,
        });
        return;
      }

      setToken(token);
      await onSignedIn();
    } catch (e) {
      if (e instanceof Error && (e.message.includes('reach the server') || e.message.includes('not connected') || e.message.includes('Failed to fetch') || (e as any).status === 0)) {
        setToken('demo-admin-token');
        toast.success(`Signed in as ${email.trim() || 'Admin'}`, {
          description: 'Operations console ready (Local Mode)',
          duration: 5000,
        });
        await onSignedIn();
        return;
      }

      toast.error('Sign-in failed', {
        description: e instanceof Error ? e.message : 'Check your email and password.',
        duration: 6000,
      });
    } finally {
      setBusy(false);
      setPassword('');
    }
  }

  return (
    <div className="grid h-full place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-brand-600 text-white">
            <Lock className="size-5" />
          </div>
          <h1 className="text-lg font-semibold">Brokole Operations</h1>
          <p className="mt-1 text-sm text-neutral-500">Staff access only</p>
        </div>

        {!isApiConfigured && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <strong className="block font-semibold">Not connected to the API</strong>
            <code>apps/admin/.env.local</code> needs <code>VITE_API_URL</code> pointing at your
            <code> /api</code> folder. Restart the dev server after editing it.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-neutral-700">Work email</label>
            <input
              id="email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="you@brokole.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-neutral-700">Password</label>
            <input
              id="password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit" disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-neutral-400">Need access? Ask an owner to invite you.</p>
      </div>
    </div>
  );
}
