/** A material property of the active configuration that cannot be used (usVIS04 BR 15). */
export class MaterialBuildError extends Error {
  /**
   * @param {string} property the WEB06 material key that is wrong
   * @param {'invalid-range' | 'invalid-color' | 'incomplete-maps'} reason
   */
  constructor(property, reason) {
    super(`Invalid material property ${property} (${reason})`);
    this.name = 'MaterialBuildError';
    this.property = property;
    this.reason = reason;
  }
}