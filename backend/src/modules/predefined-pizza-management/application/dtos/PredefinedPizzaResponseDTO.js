export class PredefinedPizzaResponseDTO {
  constructor({ id, componentIds }) {
    this.id = id;
    this.componentIds = Object.freeze([...componentIds]);
    Object.freeze(this);
  }
}
