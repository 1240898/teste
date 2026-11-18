import { useLocale } from '../../../shared/locale/localeContext.js';

function syntaxMessage(error) {
  if (!error) return null;
  if (error.code === 'empty') return ['kitchenEmptyJson'];
  if (error.code === 'notObject') return ['kitchenNotObject'];
  return error.line
    ? ['kitchenSyntaxError', { line: error.line, column: error.column }]
    : ['kitchenSyntaxErrorNoPosition'];
}

/** JSON text area with the syntax error of BR 4 (line / column). */
export default function JsonContentEditor({
  id,
  value,
  onChange,
  syntaxError = null,
  readOnly = false,
}) {
  const { t } = useLocale();
  const message = syntaxMessage(syntaxError);
  const describedBy = [`${id}-hint`, message && `${id}-error`]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="form-field kitchen-json">
      <label htmlFor={id}>{t('kitchenJsonContent')}</label>
      <p className="field-hint" id={`${id}-hint`}>
        {t('kitchenJsonHint')}
      </p>
      <textarea
        id={id}
        className="kitchen-json__text"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        rows={22}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy}
      />
      {message && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {t(...message)}
        </p>
      )}
    </div>
  );
}