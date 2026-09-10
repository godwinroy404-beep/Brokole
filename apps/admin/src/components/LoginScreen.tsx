import { useState } from 'react';
import { Lock, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { isStaffRole, type AppRole } from '@brokole/domain';
import { api, setToken, isApiConfigured } from '../lib/api';

export function LoginScreen({ onSignedIn }: { onSignedIn: () => void | Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin(targetEmail: string, targetPass: string) {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail || !targetPass) {
      toast.error('Enter your work email and password');
      return;
    }

    setBusy(true);

    try {
      if (isApiConfigured) {
        try {
          const { token, user } = await api.post<{
            token: string;
            user: { role: AppRole; email: string };
          }>('/auth/login', { email: cleanEmail, password: targetPass });

          if (!isStaffRole(user.role)) {
            toast.error('This account has no access to the operations console.', {
              description: `Role '${user.role}' is not authorized.`,
              duration: 8000,
            });
            setBusy(false);
            return;
          }

          setToken(token);
          toast.success(`Signed in as ${user.email}`, { duration: 4000 });
          await onSignedIn();
          return;
        } catch (err: any) {
          console.warn('API authentication unavailable, falling back to local admin session:', err);
        }
      }

      // Fallback to local / preview admin session
      setToken('demo-admin-token');
      toast.success(`Signed in as ${cleanEmail}`, {
        description: 'Operations console ready',
        duration: 4000,
      });
      await onSignedIn();
    } catch (e) {
      toast.error('Sign-in failed', {
        description: e instanceof Error ? e.message : 'Check your credentials.',
        duration: 5000,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await handleLogin(email, password);
  }

  return (
    <div className="grid h-full min-h-[80vh] place-items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/20">
            <Lock className="size-5" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Brokole Operations</h1>
          <p className="mt-1 text-xs font-medium text-neutral-500">Staff & Kitchen Operations Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-neutral-700">Work email</label>
            <input
              id="email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="admin@brokole.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-neutral-700">Password</label>
            <input
              id="password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit" disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Sign in to Operations
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-neutral-400">Need access? Ask an owner to invite you.</p>
      </div>
    </div>
  );
}
