import { createHash, randomBytes } from 'node:crypto';

export class RecoveryTokenServiceAdapter {
  createLinkToken() {
    const plaintextToken = randomBytes(32).toString('base64url');
    return { plaintextToken, tokenHash: this.hashToken(plaintextToken) };
  }

  hashToken(plaintextToken) {
    return createHash('sha256').update(plaintextToken, 'utf8').digest('hex');
  }
}
