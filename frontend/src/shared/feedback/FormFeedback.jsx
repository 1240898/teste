import { useLocale } from '../locale/localeContext.js';
import FeedbackMessage from './FeedbackMessage.jsx';

export default function FormFeedback({ error, message, values }) {
  return (
    <>
      <FeedbackMessage severity="error" messageKey={error} values={values} />
      <FeedbackMessage
        severity="success"
        messageKey={message}
        values={values}
      />
    </>
  );
}

export function FieldLabel({ id, label }) {
  const { t } = useLocale();
  return (
    <label htmlFor={id}>
      {t(label)} <span className="required-field">({t('requiredField')})</span>
    </label>
  );
}

export function FieldError({ id, issue }) {
  const { t } = useLocale();
  return issue ? (
    <p className="field-error" id={`${id}-error`}>
      {t(issue.key, issue)}
    </p>
  ) : null;
}
