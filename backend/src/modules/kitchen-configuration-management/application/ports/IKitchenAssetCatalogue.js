/**
 * Read-only kitchen asset catalogue (D8), seeded from the versioned manifest.
 * @typedef {Object} IKitchenAssetCatalogue
 * @property {(ids: string[], tx?: object) => Promise<Map<string, import('../../domain/model/KitchenAsset.js').KitchenAsset>>} findByIds
 * @property {() => Promise<import('../../domain/model/KitchenAsset.js').KitchenAsset[]>} findAll
 */
export {};