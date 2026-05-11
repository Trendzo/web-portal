// MOCK_DEPENDENCY: §0 Cross-cutting (mock infrastructure root)
//
// Single helper that stand-in callsites use until backend lands. Every mock
// route registers its key here so a runtime introspection (or tests) can list
// every endpoint still served by fixtures.
//
// Replacement protocol when backend lands:
//   1. Delete the call to mockFetch from the consuming module.
//   2. Replace with `api<T>(path)` from '@/lib/api'.
//   3. Drop the `// MOCK_DEPENDENCY: §N <module>` marker at the top of the file.
//   4. Drop the corresponding `<MockDataBadge />` from the page header.
//   5. Delete the fixture from `lib/mocks/<module>.ts`.

const MOCK_REGISTRY: Set<string> = new Set();

export type MockOpts = {
  /** Simulated network latency in ms. Default 250. */
  delayMs?: number;
  /** Probability (0..1) of a synthetic failure to exercise error UI. Default 0. */
  failRate?: number;
  /** Error message used when a synthetic failure fires. */
  failMessage?: string;
};

/**
 * Return a fixture as a Promise mimicking `api()` shape. Registers the key in
 * MOCK_REGISTRY at first call so we can list every still-mocked endpoint.
 *
 * Test override: when `window.__MOCK_BACKEND_LIVE === true` (set by the
 * Playwright lifecycle fixture), the call is forwarded to a real `fetch()`
 * against the same key path. This makes mocked endpoints visible to
 * `page.route('**\/api/v1/**')` so end-to-end specs can mutate state and
 * assert it propagates. The fixture passed in still serves as the fall-back
 * payload when the test backend has no specific handler.
 */
export function mockFetch<T>(key: string, fixture: T | (() => T), opts: MockOpts = {}): Promise<T> {
  MOCK_REGISTRY.add(key);
  const { delayMs = 250, failRate = 0, failMessage = 'Mock failure' } = opts;

  // Route through a real fetch so Playwright `page.route` can intercept.
  if (typeof window !== 'undefined' && (window as { __MOCK_BACKEND_LIVE?: boolean }).__MOCK_BACKEND_LIVE) {
    const base = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || '/api/v1';
    return fetch(`${base}${key}`)
      .then((res) => res.json())
      .then((envelope) => {
        if (envelope && typeof envelope === 'object' && envelope.success === true) {
          return envelope.data as T;
        }
        // Backend returned a not-found / error envelope — fall back to fixture
        // so pages still render in mocked mode rather than crashing.
        return typeof fixture === 'function' ? (fixture as () => T)() : fixture;
      })
      .catch(() => (typeof fixture === 'function' ? (fixture as () => T)() : fixture));
  }

  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      if (failRate > 0 && Math.random() < failRate) {
        reject(new Error(failMessage));
        return;
      }
      const value = typeof fixture === 'function' ? (fixture as () => T)() : fixture;
      resolve(value);
    }, delayMs);
  });
}

/** True when `path` has been seen by `mockFetch` during this session. */
export function isMockEndpoint(path: string): boolean {
  return MOCK_REGISTRY.has(path);
}

/** Snapshot of every key currently served by `mockFetch`. Useful in dev tools. */
export function listMockEndpoints(): string[] {
  return Array.from(MOCK_REGISTRY).sort();
}
