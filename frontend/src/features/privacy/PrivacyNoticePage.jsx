import { useLocale } from '../../shared/locale/localeContext.js';

// WEB03 (BR 4, AC 4): public privacy notice, readable by every role including
// Guest. The text summarises the personal data identified for the project
// (GDP01 / GDP02); the GDP stories own its legal wording and may refine it.
const SECTIONS = [
  ['privacyControllerTitle', ['privacyController']],
  [
    'privacyDataTitle',
    ['privacyDataAccount', 'privacyDataCustomer', 'privacyDataAccess'],
  ],
  ['privacyPurposeTitle', ['privacyPurpose']],
  ['privacyRetentionTitle', ['privacyRetention']],
  ['privacyRightsTitle', ['privacyRights']],
];

export default function PrivacyNoticePage() {
  const { t } = useLocale();
  return (
    <article className="privacy-notice" aria-labelledby="privacy-title">
      <h1 id="privacy-title">{t('privacyNotice')}</h1>
      <p className="intro">{t('privacyIntro')}</p>
      {SECTIONS.map(([titleKey, paragraphKeys]) => (
        <section key={titleKey}>
          <h2>{t(titleKey)}</h2>
          {paragraphKeys.length > 1 ? (
            <ul>
              {paragraphKeys.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          ) : (
            <p>{t(paragraphKeys[0])}</p>
          )}
        </section>
      ))}
    </article>
  );
}