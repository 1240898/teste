import { createHash, randomBytes } from 'node:crypto';

export class ActivationInvitationTokenService {
  create() {
    const plaintextToken = randomBytes(32).toString('base64url');
    return { plaintextToken, tokenHash: this.hash(plaintextToken) };
  }

  hash(token) {
    return createHash('sha256').update(token).digest('hex');
  }
}
