/** @typedef {import('../readModels/ApplicationSession.js').ApplicationSession} ApplicationSession */

/** @interface */
export class IApplicationSessionRepository {
  create(_session) {
    throw new Error('Not implemented');
  }
  findActive(_id, _userId) {
    throw new Error('Not implemented');
  }
  renew(_id, _credentialHash, _csrfHash, _replacement, _idleSeconds) {
    throw new Error('Not implemented');
  }
  revoke(_id, _credentialHash, _csrfHash) {
    throw new Error('Not implemented');
  }
  revokeAllForUser(_userId, _queryable) {
    throw new Error('Not implemented');
  }
}

/** @interface */
export class ISessionCredentialService {
  create() {
    throw new Error('Not implemented');
  }
  parse(_value) {
    throw new Error('Not implemented');
  }
}
