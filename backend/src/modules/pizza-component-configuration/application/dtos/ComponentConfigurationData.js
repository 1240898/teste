export class ComponentConfigurationData {
  constructor({ amount, currency, stockUnitsConsumed }) {
    Object.assign(this, { amount, currency, stockUnitsConsumed });
    Object.freeze(this);
  }
}
