import ConfirmationDialog from '../../../shared/feedback/ConfirmationDialog.jsx';

/** WEB04 AC 6: deleting is confirmed; only inactive configurations reach it. */
export default function DeleteConfirmDialog({ target, onConfirm, onCancel }) {
  return (
    <ConfirmationDialog
      open={Boolean(target)}
      titleKey="kitchenDeleteTitle"
      consequenceKey="kitchenDeleteConsequence"
      consequenceValues={{ name: target?.name, id: target?.id }}
      confirmLabelKey="kitchenDelete"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}