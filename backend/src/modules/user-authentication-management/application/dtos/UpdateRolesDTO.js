export class UpdateRolesDTO {
  constructor({ roles }) {
    this.roles = [...roles];
  }
}
