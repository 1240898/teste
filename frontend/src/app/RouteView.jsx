import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';

// Only mounted views report an outcome. A guard or Suspense fallback reports
// its own state, and unmounting cancels the corresponding report.
export default function RouteView({
  onView,
  kind,
  titleKey,
  currentSectionId = null,
  ready = true,
  children,
}) {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const view = { pathname, kind, titleKey, currentSectionId, ready };
    onView(view);
    return () => onView((current) => (current === view ? null : current));
  }, [pathname, kind, titleKey, currentSectionId, ready, onView]);

  return children;
}
