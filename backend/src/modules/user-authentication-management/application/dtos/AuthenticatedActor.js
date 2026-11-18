/**
 * AA03: the authenticated actor placed in req.user by AuthMiddleware.
 * Roles always come from the persisted User, never from the JWT claim
 * or from anything supplied by the client.
 */
export class AuthenticatedActor {
  constructor({ sub, email, roles }) {
    this.sub = sub;
    this.email = email;
    this.roles = [...roles];
    Object.freeze(this.roles);
    Object.freeze(this);
  }
  static fromUser(user) {
    return new AuthenticatedActor({
      sub: user.getId().getValue(),
      email: user.getEmail().getValue(),
      roles: user.getRoles(),
    });
  }
}