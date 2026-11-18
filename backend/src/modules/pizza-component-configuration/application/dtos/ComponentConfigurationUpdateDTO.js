export class ComponentConfigurationUpdateDTO {
  constructor(changes) {
    Object.assign(this, changes);
    Object.freeze(this);
  }
}
