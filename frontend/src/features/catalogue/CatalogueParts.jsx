
import { useLocale } from '../../shared/locale/localeContext.js';
import { allergenLabel } from '../../shared/locale/allergenLabels.js';

/**
 * WEB05 AC 4 / Table 1: allergen information is always shown.
 * Names come from the client locale by allergen id (EU 1-14), so they follow
 * the selected language; the API name is only a fallback.
 */
export function AllergenList({ allergens, showLabel = true }) {
  const { t } = useLocale();
  if (!allergens?.length)
    return <p className="catalogue-allergens">{t('noAllergens')}</p>;
  return (
    <p className="catalogue-allergens">
      {showLabel && (
        <span className="catalogue-allergens__label">{t('allergens')}: </span>
      )}
      {allergens.map((allergen) => (
        <span className="tag" key={allergen.id}>
          {allergenLabel(allergen.id, allergen.name, t)}
        </span>
      ))}
    </p>
  );
}

export function AvailabilityTag({ available }) {
  const { t } = useLocale();
  return available ? null : (
    <span className="tag tag--muted">{t('unavailable')}</span>
  );
}
