export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [status]
   * @param {Array<{path: string, code: string, message: string}>} [details]
   *   WEB06 (ALN-1): optional list of issues, sent to the client only for 4xx.
   */
  constructor(message, status = 400, details) {
    super(message);
    this.status = status;
    if (Array.isArray(details)) this.details = details;
  }
}