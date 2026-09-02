import { createClient } from '@supabase/supabase-js';

/**
 * Admin console Supabase client.
 *
 * Accepts either key name, so it works whichever one you paste in:
 *   VITE_SUPABASE_PUBLISHABLE_KEY   sb_publishable_...  (current)
 *   VITE_SUPABASE_ANON_KEY          eyJhbGci...         (legacy, retiring end of 2026)
 *
 * Note the VITE_ prefix. Supabase's docs show NEXT_PUBLIC_ because they assume
 * Next.js; Vite only exposes variables that start with VITE_, so a NEXT_PUBLIC_
 * name here would silently arrive as undefined.
 *
 * A publishable key is safe in the browser: it identifies the project, it does
 * not grant access. Row Level Security decides what any given signed-in user
 * can reach. A SECRET key is the opposite - it bypasses RLS entirely - and in a
 * Vite app it would be compiled into the bundle for every visitor to read, so
 * the guard below refuses to start with one.
 */
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const rawKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/** A secret key in a browser app is never a mistake worth "working around". */
export const hasSecretKeyMistake = Boolean(
  rawKey && (rawKey.startsWith('sb_secret_') || rawKey.includes('service_role')),
);

if (hasSecretKeyMistake) {
  // Loud, and the client below is left unconfigured so nothing can use it.
  console.error(
    '[supabase] A SECRET key was found in a browser environment variable. ' +
      'It bypasses Row Level Security and would ship inside the JavaScript bundle. ' +
      'Replace it with the publishable key (sb_publishable_...) from Settings -> API Keys.',
  );
}

const looksPlaceholder = (v: string) =>
  v.includes('placeholder') || v.includes('YOUR-PROJECT-REF') ||
  v.includes('YOUR-ANON-KEY') || v.includes('YOUR-PUBLISHABLE-KEY');

export const isSupabaseConfigured = Boolean(
  rawUrl &&
    rawKey &&
    rawUrl.startsWith('https://') &&
    !looksPlaceholder(rawUrl) &&
    !looksPlaceholder(rawKey) &&
    !hasSecretKeyMistake,
);

const url = isSupabaseConfigured ? rawUrl! : 'https://placeholder-project.supabase.co';
const anonKey = isSupabaseConfigured
  ? rawKey!
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(url, anonKey, {
  auth: {
    // A distinct storage key so an admin session and a customer session can
    // never be mistaken for one another, even on the same machine.
    storageKey: 'brokole-admin-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
