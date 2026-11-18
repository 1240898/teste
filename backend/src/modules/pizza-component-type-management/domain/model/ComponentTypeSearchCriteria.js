/** Domain-owned criteria: ID and exact name match with OR semantics. */
export class ComponentTypeSearchCriteria {
  constructor({ id, name } = {}) {
    this.id = id;
    this.name = name;
    Object.freeze(this);
  }
}
