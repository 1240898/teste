import { toFeedback } from '../../shared/feedback/errorMapper.js';
import { hasMessage } from '../../shared/locale/messages.js';

/**
 * Message of a validation issue in the current language, derived at render
 * time from its stable code (+ variant) and params, so a language switch
 * re-translates it without a request (BR 21). Server text is the fallback.
 */
export function issueMessage(t, issue) {
  const variant = issue.params?.variant;
  const key = variant
    ? `kitchenIssue:${issue.code}:${variant}`
    : `kitchenIssue:${issue.code}`;
  return hasMessage(key) ? t(key, issue.params) : issue.message;
}

/** Feedback of a failed activation / deletion (WEB04: never shown as done). */
export function actionFeedback(error) {
  if (error?.status === 422)
    return { severity: 'error', messageKey: 'kitchenActivationInvalid' };
  if (error?.status === 404)
    return { severity: 'error', messageKey: 'kitchenConfigurationGone' };
  if (error?.status === 409 && /delete/i.test(error.message ?? ''))
    return { severity: 'error', messageKey: 'kitchenActiveNotDeletable' };
  if (error?.status === 409 && /activation/i.test(error.message ?? ''))
    return { severity: 'error', messageKey: 'kitchenActivationRace' };
  return toFeedback(error);
}