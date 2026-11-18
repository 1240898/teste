/**
 * @typedef {object} IRecoveryTokenRepository
 * @property {(userId: string, tokenHash: string, expiresAt: Date, tx: import('pg').PoolClient) => Promise<boolean>} replaceActive
 * @property {(tokenHash: string, tx: import('pg').PoolClient) => Promise<import('../readModels/RecoveryTokenCandidate.js').RecoveryTokenCandidate|null>} findUsableForUpdate
 * @property {(tokenHash: string, userId: string, passwordHash: string, tx: import('pg').PoolClient) => Promise<boolean>} consumeAndUpdatePassword
 */

/**
 * @typedef {object} IRecoveryDelivery
 * @property {(email: string, link: string) => Promise<void>} sendRecoveryLink
 */

/**
 * @typedef {object} IRecoveryTokenService
 * @property {() => {plaintextToken: string, tokenHash: string}} createLinkToken
 * @property {(plaintextToken: string) => string} hashToken
 */
