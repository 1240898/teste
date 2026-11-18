export class ReplacePizzaConfigurationDTO {
  constructor({ componentIds }) {
    this.componentIds = componentIds;
    Object.freeze(this);
  }
}
