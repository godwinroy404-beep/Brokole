/**
 * DEPRECATED — the admin console now talks to the PHP API in /api, backed by
 * MySQL. Kept only so older imports compile; no network calls, no dependency.
 */
export { isApiConfigured as isSupabaseConfigured } from './api';
