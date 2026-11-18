import { useLayoutEffect, useRef } from 'react';
import { useLocale } from '../shared/locale/localeContext.js';

export default function RouteOrientation({ view, mainRef }) {
  const { t } = useLocale();
  const lastFocused = useRef(null);
  const viewKey = view?.ready ? `${view.pathname}:${view.kind}` : null;

  useLayoutEffect(() => {
    const title = view?.titleKey;
    document.title = title ? `${t(title)} · LaPrizza` : 'LaPrizza';
  }, [t, view?.titleKey]);

  useLayoutEffect(() => {
    if (viewKey === null) {
      lastFocused.current = null;
      return;
    }
    if (lastFocused.current === viewKey) return;
    const main = mainRef.current;
    if (!main) return;
    const target = main.querySelector('h1, h2') ?? main;
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'start' });
    lastFocused.current = viewKey;
  }, [mainRef, viewKey]);

  return null;
}
