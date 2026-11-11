import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';

/**
 * Light/dark for the app. One setting, shared by the map and the admin
 * dashboard; the landing page, legal pages and developer docs stay light.
 *
 * Dark is the `dark` class on <html> (set by <ThemeSync />). Tailwind's
 * `dark:` utilities key off it (see @custom-variant in index.css) and
 * styles/theme-dark.css flips the brand tokens under it.
 */
const KEY = 'theme';
const LEGACY_KEY = 'admin-theme';
const listeners = new Set();

function read() {
  try {
    const saved = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage blocked: follow the device
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let current = read();

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setTheme(next) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // not saved; still applies for this visit
  }
  listeners.forEach((fn) => fn());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => 'light');
  return { theme, dark: theme === 'dark', setTheme, toggle: () => setTheme(current === 'dark' ? 'light' : 'dark') };
}

/** Pages that have a dark theme. Everything else (landing, legal, docs) stays light. */
export function pathIsThemed(pathname) {
  return (
    pathname === '/map' ||
    pathname.startsWith('/map/') ||
    pathname.startsWith('/promote') ||
    pathname.startsWith('/event') ||
    pathname.startsWith('/admin')
  );
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Keeps the `dark` class on <html> in step with the setting and the current page. */
export function useApplyTheme(pathname) {
  const { dark } = useTheme();
  const themed = pathIsThemed(pathname);
  useIsoLayoutEffect(() => {
    const on = dark && themed;
    document.documentElement.classList.toggle('dark', on);
    document.documentElement.style.colorScheme = on ? 'dark' : '';
  }, [dark, themed]);
}
