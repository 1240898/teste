/** Application port for recording a privacy-safe SecurityEvent. */
export class ISecurityLogger {
  record(_event) {
    throw new Error('Not implemented');
  }
}
