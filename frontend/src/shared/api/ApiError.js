const isIssue = (issue) =>
  issue !== null &&
  typeof issue === 'object' &&
  ['path', 'code', 'message'].every((key) => typeof issue[key] === 'string');

/**
 * WEB06 (ALN-2): keeps `details` only when it is an array of
 * { path, code, message } strings; `params` (values used to translate the
 * message by code) is kept when it is a plain object.
 */
export function toIssueDetails(details) {
  if (!Array.isArray(details) || !details.every(isIssue)) return undefined;
  return details.map(({ path, code, message, params }) => ({
    path,
    code,
    message,
    params:
      params && typeof params === 'object' && !Array.isArray(params)
        ? { ...params }
        : {},
  }));
}

export class ApiError extends Error {
  constructor(status, message, kind = 'http', details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    const issues = toIssueDetails(details);
    if (issues) this.details = issues;
  }
}