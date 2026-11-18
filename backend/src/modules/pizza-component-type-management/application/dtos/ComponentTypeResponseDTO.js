export class ComponentTypeResponseDTO {
  constructor({ id, name, assemblyOrder, minQuantity, maxQuantity }) {
    Object.assign(this, { id, name, assemblyOrder, minQuantity, maxQuantity });
    Object.freeze(this);
  }
}
