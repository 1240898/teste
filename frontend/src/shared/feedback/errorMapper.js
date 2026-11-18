const STATUS_MESSAGES = new Map([
  [400, 'validationFailed'],
  [401, 'signInAgain'],
  [403, 'insufficientPermission'],
  [404, 'resourceUnavailable'],
  [409, 'operationConflict'],
  [412, 'staleVersion'],
  [422, 'validationFailed'],
  [503, 'serviceUnavailable'],
]);

/** Map normalized error metadata to safe localized copy; never use error.message. */
export function toFeedback(error, fallback = 'unknownMessage') {
  if (error?.kind === 'network' || error?.kind === 'timeout')
    return { severity: 'error', messageKey: 'connectionError' };
  if (error?.kind === 'aborted')
    return { severity: 'error', messageKey: 'requestUnconfirmed' };

  return {
    severity: 'error',
    messageKey: STATUS_MESSAGES.get(error?.status) ?? fallback,
  };
}
