import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE } from './localeStorage.js';
import { translate } from './messages.js';

export const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  t: (key, values) => translate(DEFAULT_LOCALE, key, values),
});

export function useLocale() {
  return useContext(LocaleContext);
}
