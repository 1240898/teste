export class InputError extends Error {
  constructor(code, message, status = 422, field, reference) {
    super(message);
    Object.assign(this, { code, status, field, reference });
  }
}

export function requireValue(condition, code, field, reference, message) {
  if (!condition) throw new InputError(code, message, 422, field, reference);
}

export function safeInteger(value, field, reference) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  requireValue(Number.isSafeInteger(number) && number >= 0,
    'INVALID_QUANTITY', field, reference, 'Expected a non-negative safe integer.');
  return number;
}
