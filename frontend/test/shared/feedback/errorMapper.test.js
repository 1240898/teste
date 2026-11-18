import { toFeedback } from '../../../src/shared/feedback/errorMapper.js';

test.each([
  [{ kind: 'network' }, 'connectionError'],
  [{ kind: 'timeout' }, 'connectionError'],
  [{ kind: 'aborted' }, 'requestUnconfirmed'],
  [{ status: 401, message: 'secret server detail' }, 'signInAgain'],
  [{ status: 403 }, 'insufficientPermission'],
  [{ status: 409 }, 'operationConflict'],
  [{ status: 412 }, 'staleVersion'],
  [{ status: 422 }, 'validationFailed'],
  [{ status: 503 }, 'serviceUnavailable'],
  [{ status: 418, message: 'secret server detail' }, 'unknownMessage'],
])('maps %o to safe localized feedback', (error, messageKey) => {
  expect(toFeedback(error)).toEqual({ severity: 'error', messageKey });
  expect(toFeedback(error)).not.toHaveProperty('message', error.message);
});
