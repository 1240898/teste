import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export class JwtTokenService {
  constructor({ secret, expiresIn, issuer, audience }) {
    Object.assign(this, { secret, expiresIn, issuer, audience });
  }
  generateToken(payload) {
    return jwt.sign(payload, this.secret, {
      algorithm: 'HS256',
      jwtid: randomUUID(),
      expiresIn: this.expiresIn,
      issuer: this.issuer,
      audience: this.audience,
    });
  }
  verifyToken(token) {
    const payload = jwt.verify(token, this.secret, {
      algorithms: ['HS256'],
      issuer: this.issuer,
      audience: this.audience,
    });
    if (
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.jti !== 'string' ||
      !Number.isInteger(payload.exp) ||
      !Number.isInteger(payload.iat)
    )
      throw new Error('Invalid token claims');
    return payload;
  }
}
