/**
 * A configuration element that cannot be turned into a 3D object (usVIS02
 * BR 11). The engine reports it as the cause of a build failure.
 * reason: 'unknown-shape' | 'invalid-number' | 'asset-missing' | 'asset-kind'
 *   | 'invalid-material' (a MaterialBuildError of the element, VIS04-ALN-8)
 */
export class ElementBuildError extends Error {
  constructor(elementId, reason, { cause } = {}) {
    super(`Kitchen element ${elementId} cannot be built (${reason})`, {
      cause,
    });
    this.name = 'ElementBuildError';
    this.elementId = elementId;
    this.reason = reason;
  }
}