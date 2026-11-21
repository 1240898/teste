import { InputError } from '../domain/InputError.js';

export function planningError(error, _req, res, next) {
  if (!(error instanceof InputError)) return next(error);
  const { status, code, message, field, reference } = error;
  res
    .status(status)
    .json({
      error: {
        status,
        code,
        message,
        ...(field && {
          details: [{ path: field, code, message, params: { reference } }],
        }),
      },
    });
}
