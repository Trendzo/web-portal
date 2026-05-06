import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'closetx.theme';

function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

/**
 * Read + persist + sync the dark/light theme. Initial value is set in index.html
 * before paint; this hook only matters once React mounts.
 */
export function useTheme(): {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    if (readStoredTheme()) return readStoredTheme()!;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Keep DOM in sync if state changes via setTheme.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore quota / privacy mode
    }
    setThemeState(t);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return { theme, setTheme, toggleTheme };
}
