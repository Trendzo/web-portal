import { useEffect } from 'react';

/**
 * Theme is fixed to light. Dark mode toggle removed; this hook only ensures the
 * `dark` class is stripped from <html> in case it was set by a legacy stored pref.
 */
export type Theme = 'light';

export function useTheme(): { theme: Theme } {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try {
      localStorage.removeItem('trendzo.theme');
    } catch {
      // ignore
    }
  }, []);
  return { theme: 'light' };
}
