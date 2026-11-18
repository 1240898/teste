import { useLocale } from '../../../shared/locale/localeContext.js';
import { issueMessage } from '../kitchenFeedback.js';

/** One row per issue: JSON path + message (WEB04 AC 2, BR 21). */
export default function ValidationIssueList({ issues, id = 'kitchen-issues' }) {
  const { t } = useLocale();
  if (!issues?.length) return null;
  return (
    <section
      className="kitchen-issues"
      role="alert"
      aria-labelledby={`${id}-title`}
    >
      <h3 id={`${id}-title`}>{t('kitchenIssuesTitle')}</h3>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.path}|${issue.code}|${index}`}>
            <code>{issue.path || t('kitchenIssueRoot')}</code>{' '}
            <span>{issueMessage(t, issue)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}