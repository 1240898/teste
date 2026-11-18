export class ViewerEngineError extends Error {
  constructor(phase, { cause, moduleName } = {}) {
    super(`Kitchen viewer engine failed during ${phase}`, { cause });
    this.name = 'ViewerEngineError';
    this.phase = phase;
    if (moduleName) this.moduleName = moduleName;
  }
}
