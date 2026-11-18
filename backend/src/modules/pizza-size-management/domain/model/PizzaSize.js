import { PizzaSizeId, PizzaSizeName } from './values.js';

export class PizzaSize {
  constructor({ id, name, isActive = true }) {
    Object.assign(this, { id, name, isActive });
    this.validateInvariants();
  }
  static create(id, name) {
    return new PizzaSize({ id, name });
  }
  static restore(data) {
    return new PizzaSize(data);
  }
  updateName(name) {
    this.name = name;
    this.validateInvariants();
  }
  activate() {
    this.isActive = true;
    this.validateInvariants();
  }
  deactivate() {
    this.isActive = false;
    this.validateInvariants();
  }

  getId() {
    return this.id;
  }

  validateInvariants() {
    if (!(this.id instanceof PizzaSizeId) || !(this.name instanceof PizzaSizeName))
      throw new TypeError('Invalid PizzaSize aggregate');
    if (typeof this.isActive !== 'boolean')
      throw new TypeError('Invalid PizzaSize active state');
  }
}
