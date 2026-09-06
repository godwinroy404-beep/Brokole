/**
 * DEPRECATED - Brokole now runs on MySQL behind the PHP API in /api.
 *
 * This file only remains so older imports keep compiling. It performs no
 * network calls and pulls in no Supabase dependency. Use ./api instead;
 * `isSupabaseConfigured` is re-exported from there under its old name so the
 * "not connected" banners keep working.
 */
export { isApiConfigured as isSupabaseConfigured } from './api';
