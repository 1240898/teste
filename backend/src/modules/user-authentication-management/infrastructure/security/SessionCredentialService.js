import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

const digest = (value) => createHash('sha256').update(value).digest();

export class SessionCredentialService {
  create() {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const value = `${id}.${secret}`;
    return {
      id,
      value,
      hash: digest(secret),
      csrfToken,
      csrfTokenBytes: Buffer.from(csrfToken, 'base64url'),
    };
  }

  parse(value) {
    if (typeof value !== 'string' || value.length > 256) return null;
    const match =
      /^([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})\.([A-Za-z0-9_-]{43})$/i.exec(
        value,
      );
    if (!match) return null;
    return { id: match[1], hash: digest(match[2]) };
  }

  matchesCsrf(expectedToken, supplied) {
    if (
      !Buffer.isBuffer(expectedToken) ||
      typeof supplied !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(supplied)
    )
      return false;
    const suppliedBytes = Buffer.from(supplied, 'base64url');
    return expectedToken.length === suppliedBytes.length &&
      timingSafeEqual(expectedToken, suppliedBytes);
  }
}
