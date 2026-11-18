import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { LocaleContext } from './localeContext.js';
import { isSupportedLocale, readLocale, writeLocale } from './localeStorage.js';
import { translate } from './messages.js';

export default function LocaleProvider({ children }) {
  const [locale, setLocale] = useState(readLocale);
  const [saveFailed, setSaveFailed] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const changeLocale = useCallback((next) => {
    if (!isSupportedLocale(next)) return;
    setLocale(next);
    setSaveFailed(!writeLocale(next));
  }, []);

  const value = useMemo(
    () => ({
      locale,
      changeLocale,
      saveFailed,
      t: (key, values) => translate(locale, key, values),
    }),
    [locale, changeLocale, saveFailed],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
