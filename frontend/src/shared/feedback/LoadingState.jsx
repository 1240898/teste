import { useLocale } from '../locale/localeContext.js';

export default function LoadingState({ labelKey = 'loadingSection' }) {
  const { t } = useLocale();
  return (
    <p className="feedback" role="status" aria-live="polite">
      {t(labelKey)}
    </p>
  );
}
