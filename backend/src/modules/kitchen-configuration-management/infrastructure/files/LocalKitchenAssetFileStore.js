import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ASSETS_DIRECTORY = fileURLToPath(
  new URL('../../../../../assets/kitchen/files/', import.meta.url),
);

const SAFE_PATH = /^[a-z0-9][a-z0-9._/-]*$/;

/**
 * IKitchenAssetFileStore over backend/assets/kitchen/files (BR 19). Paths that
 * would leave the root ("..", absolute paths, odd characters) never exist.
 */
export class LocalKitchenAssetFileStore {
  constructor(rootDirectory = DEFAULT_ASSETS_DIRECTORY) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  /** Absolute path of a catalogue path, or null if it is not a safe path. */
  resolve(relativePath) {
    if (
      typeof relativePath !== 'string' ||
      !SAFE_PATH.test(relativePath) ||
      relativePath.split('/').includes('..')
    )
      return null;
    const absolute = path.resolve(this.rootDirectory, relativePath);
    return absolute.startsWith(this.rootDirectory + path.sep) ? absolute : null;
  }

  async exists(relativePath) {
    const absolute = this.resolve(relativePath);
    if (!absolute) return false;
    try {
      return (await stat(absolute)).isFile();
    } catch {
      return false;
    }
  }
}