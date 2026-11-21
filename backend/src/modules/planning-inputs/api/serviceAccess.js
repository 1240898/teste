import { createHash, timingSafeEqual } from 'node:crypto';
import { InputError } from '../domain/InputError.js';

const digest = (value) => createHash('sha256').update(value).digest();

// These credentials never grant user access, stock writes or operational orders.
export function serviceAccess({ readToken, recordsToken, supplierConfirmToken }) {
  if (typeof readToken !== 'string' || readToken.length < 32 ||
      typeof recordsToken !== 'string' || recordsToken.length < 32 || readToken === recordsToken)
    throw new TypeError('Configure distinct planning read and records credentials of at least 32 characters.');
  if (supplierConfirmToken && (supplierConfirmToken.length < 32 || [readToken, recordsToken].includes(supplierConfirmToken)))
    throw new TypeError('Configure a separate supplier confirmation credential of at least 32 characters.');
  const credentials = { read: digest(readToken), records: digest(recordsToken) };
  if (supplierConfirmToken) credentials.confirm = digest(supplierConfirmToken);
  return (permission) => (req, _res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match) throw new InputError('SERVICE_UNAUTHENTICATED', 'Service authentication is required.', 401);
    const supplied = digest(match[1]);
    const matches = Object.entries(credentials).filter(([, token]) => timingSafeEqual(supplied, token));
    if (matches.length === 0)
      throw new InputError('SERVICE_UNAUTHENTICATED', 'Invalid service credential.', 401);
    if (matches[0][0] !== permission)
      throw new InputError('SERVICE_FORBIDDEN', 'This service cannot perform this operation.', 403);
    req.planningService = permission;
    next();
  };
}
