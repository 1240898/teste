import { useLocale } from '../../../shared/locale/localeContext.js';

/**
 * AC 8: which configuration the viewer uses, the confirmation after an
 * activation and "Open / reload the kitchen viewer". No active configuration
 * -> explicit warning; another layout is never suggested.
 */
export default function ActiveConfigurationBanner({
  active,
  activated,
  onOpenViewer,
}) {
  const { t } = useLocale();
  if (!active)
    return (
      <p className="feedback feedback--error" role="status">
        {t('kitchenNoActiveConfiguration')}
      </p>
    );
  const shown = activated ?? active;
  return (
    <div className="kitchen-banner" role="status">
      <p className={`feedback feedback--${activated ? 'success' : 'info'}`}>
        {t(
          activated ? 'kitchenActivatedNotice' : 'kitchenActiveConfiguration',
          {
            name: shown.name,
            id: shown.id,
          },
        )}
      </p>
      <button
        className="button button--secondary"
        type="button"
        onClick={onOpenViewer}
      >
        {t('kitchenOpenViewer')}
      </button>
    </div>
  );
}