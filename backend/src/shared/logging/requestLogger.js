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
      safeRequestPath(req),
      tokens.status(req, res),
      `${tokens['response-time'](req, res)} ms`,
    ].join(' '),
  );
}

/** Returns a matched route template, never a concrete path or query string. */
export function safeRequestPath(req) {
  if (typeof req.authorizationRouteTemplate === 'string')
    return req.authorizationRouteTemplate;
  const routePath = req.route?.path;
  if (typeof routePath !== 'string') return '/unmatched';
  return routePath.startsWith('/') ? routePath : `/${routePath}`;
}
