/** AA02: response of the start of an external sign-in. Contains no secrets. */
export class ExternalAuthorizationDTO {
  constructor({ authorizationUrl, state }) {
    this.authorizationUrl = authorizationUrl;
    this.state = state;
  }
}