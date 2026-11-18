import { useEffect, useRef } from 'react';
import { useLocale } from '../locale/localeContext.js';

export default function ConfirmationDialog({
  open,
  titleKey = 'confirmAction',
  consequenceKey,
  consequenceValues,
  confirmLabelKey = 'confirm',
  cancelLabelKey = 'cancel',
  onConfirm,
  onCancel,
}) {
  const { t } = useLocale();
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const previousFocus = useRef(null);
  const onCancelRef = useRef(onCancel);

  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    confirmRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = [cancelRef.current, confirmRef.current].filter(Boolean);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop">
      <section
        ref={dialogRef}
        className="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-consequence"
      >
        <h2 id="confirmation-title">{t(titleKey)}</h2>
        <p id="confirmation-consequence">{t(consequenceKey, consequenceValues)}</p>
        <div className="form-actions">
          <button
            ref={cancelRef}
            className="button button--secondary"
            type="button"
            onClick={onCancel}
          >
            {t(cancelLabelKey)}
          </button>
          <button
            ref={confirmRef}
            className="button button--danger"
            type="button"
            onClick={onConfirm}
          >
            {t(confirmLabelKey)}
          </button>
        </div>
      </section>
    </div>
  );
}
