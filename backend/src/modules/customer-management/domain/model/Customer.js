import { AppError } from '../../../../shared/errors/AppError.js';
import {
  CustomerId,
  CustomerName,
  ContactInfo,
  DietaryRestriction,
  LinkedUserId,
} from './values.js';
export class Customer {
  constructor({
    id,
    name,
    contactInfo,
    dietaryRestrictions = [],
    userId = null,
    active = true,
  }) {
    Object.assign(this, {
      id,
      name,
      contactInfo,
      dietaryRestrictions,
      userId,
      active,
    });
    this.validateInvariants();
  }
  static create(
    id,
    name,
    contactInfo,
    restrictions = [],
    userId = null,
  ) {
    return new Customer({
      id,
      name,
      contactInfo,
      dietaryRestrictions: restrictions,
      userId,
    });
  }
  static restore(data) {
    return new Customer(data);
  }
  updateName(name) {
    this.name = name;
    this.validateInvariants();
  }
  updateContactInfo(contactInfo) {
    this.contactInfo = contactInfo;
    this.validateInvariants();
  }
  addDietaryRestriction(value) {
    const r =
      value instanceof DietaryRestriction
        ? value
                : DietaryRestriction.create(
            value.name,
            value.description,
            value.allergenId,
          );
    if (
      this.dietaryRestrictions.some(
        (x) => x.name.toLowerCase() === r.name.toLowerCase(),
      )
    )
      return;
    this.dietaryRestrictions.push(r);
  }
  removeDietaryRestriction(name) {
    this.dietaryRestrictions = this.dietaryRestrictions.filter(
      (x) => x.name.toLowerCase() !== name.toLowerCase(),
    );
  }
  replaceDietaryRestrictions(values) {
    this.dietaryRestrictions = values.map((x) =>
      x instanceof DietaryRestriction
        ? x
                : DietaryRestriction.create(x.name, x.description, x.allergenId),
    );
    this.validateInvariants();
  }
  linkUser(userId) {
    this.userId =
      userId instanceof LinkedUserId ? userId : LinkedUserId.create(userId);
  }
  unlinkUser() {
    this.userId = null;
  }
  activate() {
    this.active = true;
  }
  deactivate() {
    this.active = false;
  }
  validateInvariants() {
    if (
      !(this.id instanceof CustomerId) ||
      !(this.name instanceof CustomerName) ||
      !(this.contactInfo instanceof ContactInfo)
    )
      throw new TypeError('Invalid Customer aggregate');
    const names = this.dietaryRestrictions.map((x) => x.name.toLowerCase());
    if (new Set(names).size !== names.length)
      throw new AppError('Duplicate dietary restriction', 400);
  }
}
