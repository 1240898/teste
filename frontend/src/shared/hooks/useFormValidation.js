import { useLayoutEffect, useRef, useState } from 'react';

export function useFormValidation() {
  const [errors, setErrors] = useState({});
  const focusTarget = useRef(null);

  useLayoutEffect(() => {
    focusTarget.current?.focus();
    focusTarget.current = null;
  }, [errors]);

  function validate(form, mismatchId) {
    const fields = [...form.elements].filter(
      (field) => field.id && field.willValidate,
    );
    const issues = {};
    for (const field of fields) {
      const { validity } = field;
      if (validity.valueMissing) issues[field.id] = { key: 'fieldRequired' };
      else if (validity.typeMismatch && field.type === 'email')
        issues[field.id] = { key: 'invalidEmail' };
      else if (validity.tooShort)
        issues[field.id] = { key: 'fieldTooShort', length: field.minLength };
      else if (!validity.valid) issues[field.id] = { key: 'invalidField' };
      else if (field.id === mismatchId)
        issues[field.id] = { key: 'passwordMismatch' };
    }
    const first = fields.find((field) => issues[field.id]);
    focusTarget.current = first;
    setErrors(issues);
    return !first;
  }

  function clearErrors(event) {
    const { id } = event.target;
    if (!errors[id]) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function fieldProps(id, hintId) {
    return {
      id,
      'aria-invalid': errors[id] ? true : undefined,
      'aria-describedby':
        [hintId, errors[id] && `${id}-error`].filter(Boolean).join(' ') ||
        undefined,
    };
  }

  return { validate, clearErrors, fieldProps, errors };
}
