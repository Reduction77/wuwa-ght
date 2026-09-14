export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'wuwa-theme';
let preference: ThemePreference = 'system';
const listeners = new Set<() => void>();

export function normalizeTheme(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(value: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  return value === 'system' ? (systemDark ? 'dark' : 'light') : value;
}

function readPreference(): ThemePreference {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function applyTheme() {
  const theme = resolveTheme(preference, window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d1520' : '#f3f9ff');
}

export function getThemePreference() {
  return preference;
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setThemePreference(value: ThemePreference) {
  preference = normalizeTheme(value);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage may be disabled: switching still works for this visit.
  }
  applyTheme();
  listeners.forEach(listener => listener());
}

/** One OS listener for the whole app; switching themes never touches account data. */
export function initializeTheme() {
  preference = readPreference();
  applyTheme();
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (preference === 'system') applyTheme();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    preference = readPreference();
    applyTheme();
    listeners.forEach(listener => listener());
  };
  media.addEventListener('change', onSystemChange);
  window.addEventListener('storage', onStorage);
  return () => {
    media.removeEventListener('change', onSystemChange);
    window.removeEventListener('storage', onStorage);
  };
}
