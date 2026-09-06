/**
 * Brokole API client (customer app).
 *
 * Replaces the Supabase client. The important difference is not the transport
 * but where security lives: with Supabase, Postgres RLS refused bad requests
 * even if this file was wrong. Against MySQL there is no such backstop - the
 * PHP API is the only thing enforcing who may see what. So this file never
 * decides anything; it just carries the token and reports what the server said.
 */

const rawBase = import.meta.env.VITE_API_URL as string | undefined;

export const isApiConfigured = Boolean(
  rawBase && /^https?:\/\//.test(rawBase) && !rawBase.includes('YOUR-DOMAIN'),
);

export const API_BASE = (rawBase ?? '').replace(/\/+$/, '');

const TOKEN_KEY = 'brokole-web-token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing - the session just won't persist */
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiError('The app is not connected to its API yet.', 0);
  }

  const token = getToken();
  let res: Response;

  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 0);
  }

  // 401 means the token is gone or expired - clear it so the UI shows signed-out
  // rather than looping on requests that can never succeed.
  if (res.status === 401) setToken(null);

  const text = await res.text();

  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /**
       * The server replied with something that isn't JSON - almost always a
       * PHP error page or a host's 500/502 HTML. Surfacing the raw parse error
       * ("Unexpected token '<'...") tells the user nothing, so report the
       * status and a readable snippet instead.
       */
      const snippet = text
        .replace(/<[^>]*>/g, ' ')       // strip tags
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);

      throw new ApiError(
        snippet
          ? `Server error (${res.status}): ${snippet}`
          : `The server returned an unreadable response (${res.status}).`,
        res.status,
      );
    }
  }

  if (!res.ok) {
    throw new ApiError((data.error as string) || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  get:   <T>(path: string) => request<T>('GET', path),
  post:  <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put:   <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
};
