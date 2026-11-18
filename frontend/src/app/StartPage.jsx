import { Link } from 'react-router';
import { useLocale } from '../shared/locale/localeContext.js';
import { SectionPlacement } from './navigation/navigationPolicy.js';

/** Start: available section shortcuts and optional session-specific content. */
export default function StartPage({ items, children }) {
  const { t } = useLocale();
  const sections = items.filter(
    ({ placement }) => placement !== SectionPlacement.HEADER,
  );
  return (
    <div className="start-content">
      {children}
      {sections.length > 0 && (
        <section className="start-sections" aria-labelledby="start-sections">
          <h2 id="start-sections">{t('availableSections')}</h2>
          <ul className="start-links">
            {sections.map(({ id, path, labelKey }) => (
              <li key={id}>
                <Link className="start-card" to={path}>
                  {t(labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
