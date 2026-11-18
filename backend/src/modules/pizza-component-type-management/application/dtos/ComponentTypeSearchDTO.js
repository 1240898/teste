export class ComponentTypeSearchDTO {
  constructor({ id, name } = {}) {
    if (id !== undefined) this.id = id;
    if (name !== undefined) this.name = name;
    Object.freeze(this);
  }
}
