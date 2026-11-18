/**
 * A catalogue row does not prove that the file can be downloaded (BR 19, D13).
 * Paths are relative to the asset store root (e.g. "models/oven-dome-01.glb").
 * @typedef {Object} IKitchenAssetFileStore
 * @property {(path: string) => Promise<boolean>} exists
 */
export {};