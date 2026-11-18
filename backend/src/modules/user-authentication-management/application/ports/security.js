/**
 * Structural ports (adapters are injected; no runtime interface hierarchy).
 * @typedef {Object} IPasswordHasher
 * @property {(plainText: string) => Promise<string>} hash
 * @property {(plainText: string, encodedHash: string) => Promise<boolean>} compare
 * @typedef {Object} ITokenService
 * @property {(payload: {sub: string, email: string, roles: string[]}) => string} generateToken
 * @property {(token: string) => {sub: string, email: string, roles: string[]}} verifyToken
 * @property {string} expiresIn
 */
export {};
