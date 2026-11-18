export class RecoveryTokenCandidate {
  constructor({ userId }) {
    if (typeof userId !== 'string' || !userId)
      throw new TypeError('Recovery token candidate requires a userId');
    this.userId = userId;
    Object.freeze(this);
  }
}
