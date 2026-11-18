/**
 * Structural repository contract for the BCK08 aggregate.
 * @typedef {Object} IComponentConfigurationRepository
 * @property {(productId: object, sizeId: object, tx: object) => Promise<object|null>} findByPair
 * @property {(productId: object, sizeId: object, tx: object) => Promise<object|null>} findByPairForUpdate
 * @property {(productId: object) => Promise<object[]>} findByProduct
 * @property {(configuration: object, tx: object) => Promise<void>} insert
 * @property {(configuration: object, tx: object) => Promise<void>} save
 */
export {};
