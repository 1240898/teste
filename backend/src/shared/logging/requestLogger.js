import morgan from 'morgan';
import { config } from '../config/index.js';

/**
 * HTTP request logging middleware. Disabled during tests to keep output clean.
 */
export function requestLogger() {
  if (config.isTest) {
    return (_req, _res, next) => next();
  }

  return morgan((tokens, req, res) =>
    [
      tokens.method(req, res),
      req.path,
      tokens.status(req, res),
      tokens['response-time'](req, res),
      'ms',
    ].join(' '),
  );
}
