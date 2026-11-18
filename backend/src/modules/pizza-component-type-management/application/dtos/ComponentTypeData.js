export class ComponentTypeData {
  constructor({ name, assemblyOrder, minQuantity, maxQuantity }) {
    Object.assign(this, { name, assemblyOrder, minQuantity, maxQuantity });
    Object.freeze(this);
  }
}
