/**
 * Central error handler. Returns a consistent JSON error structure.
 */
export function errorHandler(err, _req, res, _next) {
  const requestedStatus = err.status || err.statusCode;
  const status =
    Number.isInteger(requestedStatus) &&
    requestedStatus >= 400 &&
    requestedStatus < 500
      ? requestedStatus
      : 500;
  const message =
    status === 500
      ? 'Internal Server Error'
      : err.type === 'entity.parse.failed'
        ? 'Invalid JSON body'
        : err.type === 'entity.too.large'
          ? 'Request body too large'
          : err.message || 'Invalid request';

  const error = { message, status };
  // WEB06 (ALN-1): issue details only for client errors, never for 500.
  if (status < 500 && Array.isArray(err.details)) error.details = err.details;

  res.status(status).json({ error });
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: `Cannot ${req.method} ${req.path}`,
      status: 404,
    },
  });
}
