/**
 * Structural repository contract from the BCK01 class diagram, extended by AA02.
 * Repository operations return complete User aggregates, including their external
 * identities. Credential material stays private in Password and is excluded by
 * application response mapping.
 * Save inserts newly created Users and persists changes to Users loaded by this
 * adapter, including external identities linked after loading (AA02).
 * @typedef {Object} IUserRepository
 * @property {() => Promise<string>} nextId
 * @property {(id: import('../model/values.js').UserId) => Promise<import('../model/User.js').User|null>} findById
 * @property {(email: import('../model/values.js').Email) => Promise<import('../model/User.js').User|null>} findByEmail
 * @property {(email: import('../model/values.js').Email) => Promise<boolean>} existsByEmail
 * @property {(provider: string, subject: string) => Promise<import('../model/User.js').User|null>} findByExternalIdentity
 * @property {(user: import('../model/User.js').User) => Promise<import('../model/User.js').User>} save
 * @property {(id: import('../model/values.js').UserId, expectedHash: string, replacementHash: string) => Promise<boolean>} updatePasswordIfCurrent
 * @property {() => Promise<import('../model/User.js').User[]>} findAll
 */
export {};