import bcrypt from 'bcryptjs';

export class BcryptPasswordHasher {
  async hash(plainText) {
    if (
      typeof plainText !== 'string' ||
      Buffer.byteLength(plainText, 'utf8') > 72 ||
      plainText.includes('\0')
    )
      throw new Error('Password exceeds bcrypt input constraints');
    return bcrypt.hash(plainText, 10);
  }
  async compare(plainText, encodedHash) {
    return bcrypt.compare(plainText, encodedHash);
  }
}
