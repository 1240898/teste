import { FieldError, FieldLabel } from '../../shared/feedback/FormFeedback.jsx';
import { useLocale } from '../../shared/locale/localeContext.js';

// GDP01: same rule as the back-end PhoneNumber value object (E.164 after
// removing spaces and hyphens), so most mistakes are caught before the request.
export const PHONE_PATTERN = '\\+[1-9][0-9 \\-]{7,20}';

/** Required phone number, used by registration and by "My data". */
export default function PhoneNumberField({
  id,
  fieldProps,
  errors,
  defaultValue,
}) {
  const { t } = useLocale();
  return (
    <>
      <FieldLabel id={id} label="phoneNumber" />
      <input
        {...fieldProps(id, `${id}-hint`)}
        name="phoneNumber"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        pattern={PHONE_PATTERN}
        maxLength={32}
        defaultValue={defaultValue}
        required
      />
      <p className="field-hint" id={`${id}-hint`}>
        {t('phoneNumberHint')}
      </p>
      <FieldError id={id} issue={errors[id]} />
    </>
  );
}