/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  /** Current key name: sb_publishable_... */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy key name: eyJhbGci... (retiring end of 2026) */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
