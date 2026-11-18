/** Input validated by the API schema before reaching the application service. */
export class InviteWorkerDTO {
  constructor({ name, email, role, activationMethod }) {
    this.name = name;
    this.email = email;
    this.role = role;
    this.activationMethod = activationMethod;
  }
}
