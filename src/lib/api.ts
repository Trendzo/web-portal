import { getToken, useAuth } from './auth';
import type { Envelope } from './types';

/**
 * Thin fetch wrapper that:
 *  1. prepends the API prefix
 *  2. attaches the bearer token if any
 *  3. unwraps the `{ success, data | error }` envelope so call-sites just `await api(...)`
 *  4. throws an `ApiError` carrying the backend error code so handlers can branch on it
 *  5. on 401, clears the session and lets the router redirect to login
 */
const BASE = '/api/v1';

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

type ApiInit = Omit<RequestInit, 'body'> & { body?: unknown };

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const { body: _bodyTyped, ...rest } = init;
  void _bodyTyped;
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
