import { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isStaffRole } from '@brokole/domain';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Staff sign-in. Three deliberate absences:
 *   1. No "create account" link — staff exist only because an owner made them.
 *   2. No password stored, compared or shipped in this bundle.
 *   3. No demo / bypass button.
 * The role check below is a courtesy so a customer gets a clear message instead
 * of an empty console. It is not what keeps them out; RLS is.
 */
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      toast.error('Not connected to the database yet', {
        description: 'Put a real VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/admin/.env.local, then restart the dev server.',
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data.user) {
        // Report the real reason. "Invalid login credentials" and "cannot reach
        // the server" are very different problems.
        toast.error('Sign-in failed', {
          description: error?.message ?? 'Check your email and password.',
          duration: 6000,
        });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', data.user.id)
        .single();

      if (!profile?.is_active || !isStaffRole(profile.role)) {
        await supabase.auth.signOut();
        toast.error('This account has no access to the operations console.', {
          description:
            "It signed in fine, but its role is 'customer'. An owner must run: update public.profiles set role = 'owner' where email = '" +
            email.trim().toLowerCase() +
            "';",
          duration: 10000,
        });
        return;
      }
      // useSession picks up the change and swaps in the shell.
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

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <strong className="block font-semibold">Not connected to the database</strong>
            <code>apps/admin/.env.local</code> still holds placeholder values. Add your real
            Supabase URL and anon key, then restart the dev server.
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

        <p className="mt-4 text-center text-xs text-neutral-400">
          Need access? Ask an owner to invite you.
        </p>
      </div>
    </div>
  );
}
