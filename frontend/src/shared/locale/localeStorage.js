export const DEFAULT_LOCALE = 'pt-PT';
export const LOCALE_STORAGE_KEY = 'laprizza.locale.v1';

export function isSupportedLocale(locale) {
  return locale === DEFAULT_LOCALE || locale === 'en-GB';
}

export function readLocale() {
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(saved)) return saved;
  } catch {
    // A browser can disallow local storage.
  }
  return DEFAULT_LOCALE;
}

export function writeLocale(locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
