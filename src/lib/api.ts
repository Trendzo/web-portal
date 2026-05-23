import type { ZodType } from 'zod';
import { getToken, useAuth } from './auth';
import type { Envelope } from './types';

/**
 * Thin fetch wrapper that:
 *  1. prepends the API prefix
 *  2. attaches the bearer token if any
 *  3. unwraps the `{ success, data | error }` envelope so call-sites just `await api(...)`
 *  4. throws an `ApiError` carrying the backend error code so handlers can branch on it
 *  5. on 401, clears the session and lets the router redirect to login
 *
 * `VITE_API_BASE_URL` overrides the default. In local dev we leave it unset so
 * Vite's proxy forwards `/api/*` to the backend on :3099. On Vercel we set it to
 * the deployed backend's full URL (e.g. `https://trendzo-backend-86wn.onrender.com/api/v1`)
 * so the SPA hits the backend directly.
 */
export const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Override the bearer token (defaults to the active session's). Useful for login flows
   *  that need to call an authenticated endpoint with a token they just received but
   *  haven't yet committed to the auth store. */
  token?: string;
};

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = init.token ?? getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const { body: _bodyTyped, token: _tokenTyped, ...rest } = init;
  void _bodyTyped;
  void _tokenTyped;
  const fetchInit: RequestInit = { ...rest, headers };
  if (init.body !== undefined) fetchInit.body = JSON.stringify(init.body);
  const res = await fetch(`${BASE}${path}`, fetchInit);

  // 204 No Content shouldn't happen for our envelope endpoints, but stay defensive.
  if (res.status === 204) return undefined as T;

  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(res.status, 'invalid_response', `Non-JSON response (${res.status})`);
  }

  if (!json.success) {
    if (res.status === 401) {
      // Token is bad / expired — drop it so the router boots back to login.
      useAuth.getState().signOut();
    }
    throw new ApiError(res.status, json.error.code, json.error.message, json.error.details);
  }
  return json.data;
}

/**
 * Like `api<T>` but runs the response through a Zod schema before returning.
 *
 * Why this matters: an `api<T>` call type-asserts the success payload but does
 * not verify it at runtime. If the backend returns the wrong shape (e.g. an
 * empty array on a single-entity endpoint, a partial migration, a stale
 * deploy), call-sites blindly read fields off the value and crash deep inside
 * a render with no useful error. `apiValidated` rejects the malformed payload
 * up-front with `ApiError(code='invalid_response')`, which `useQuery` then
 * surfaces through its standard `isError` path so the route can render an
 * error state instead of throwing into the React render boundary.
 */
export async function apiValidated<T>(
  path: string,
  schema: ZodType<T>,
  init: ApiInit = {},
): Promise<T> {
  const raw = await api<unknown>(path, init);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(
      200,
      'invalid_response',
      `Response shape mismatch for ${path}`,
      parsed.error.flatten(),
    );
  }
  return parsed.data;
}
