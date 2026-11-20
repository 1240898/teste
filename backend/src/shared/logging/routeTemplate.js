/** Captures the full Express mount path while the matched route is in scope. */
export function captureRouteTemplate(req) {
  if (req.authorizationRouteTemplate) return req.authorizationRouteTemplate;
  const leaf = req.route?.path;
  if (typeof leaf !== 'string') return null;

  const base = typeof req.baseUrl === 'string' ? req.baseUrl : '';
  const leafPath = leaf === '/' ? '' : `/${leaf.replace(/^\/+/, '')}`;
  let path = `${base}${leafPath}`.replace(/\/{2,}/g, '/');
  if (!path.startsWith('/')) path = `/${path}`;
  if (path !== '/api/v1' && !path.startsWith('/api/v1/'))
    path = `/api/v1${path}`;
  req.authorizationRouteTemplate = path || '/api/v1';
  return req.authorizationRouteTemplate;
}
