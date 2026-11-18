export class ComponentTypeUpdateDTO {
  constructor(changes) {
    Object.assign(this, changes);
    Object.freeze(this);
  }
}
