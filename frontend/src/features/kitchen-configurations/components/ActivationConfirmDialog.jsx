import ConfirmationDialog from '../../../shared/feedback/ConfirmationDialog.jsx';

/** WEB04 AC 6: activation is a significant action and is confirmed. */
export default function ActivationConfirmDialog({
  target,
  currentActive,
  onConfirm,
  onCancel,
}) {
  const replaces = currentActive && currentActive.id !== target?.id;
  return (
    <ConfirmationDialog
      open={Boolean(target)}
      titleKey="kitchenActivateTitle"
      consequenceKey={
        replaces
          ? 'kitchenActivateReplaceConsequence'
          : 'kitchenActivateConsequence'
      }
      consequenceValues={{
        name: target?.name,
        id: target?.id,
        currentName: currentActive?.name,
      }}
      confirmLabelKey="kitchenActivate"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}