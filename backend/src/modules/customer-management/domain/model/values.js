import { AppError } from '../../../../shared/errors/AppError.js';
import { AllergenId } from '../../../allergen-management/domain/model/AllergenId.js';

export const CUSTOMER_ID_PATTERN = '^CUST-\\d{4,}$';
const CUSTOMER_ID_REGEX = new RegExp(CUSTOMER_ID_PATTERN, 'i');
const invalid = (message) => {
  throw new AppError(message, 400);
};
export class CustomerId {
  constructor(value) {
    if (typeof value !== 'string' || !CUSTOMER_ID_REGEX.test(value))
      invalid('Invalid customer id');
    this.value = value.toUpperCase();
    Object.freeze(this);
  }
  static create(value) {
    return new CustomerId(value);
  }
  getValue() {
    return this.value;
  }
}
export class CustomerName {
  constructor(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100)
      invalid('Name must contain 1 to 100 characters');
    this.value = value.trim();
    Object.freeze(this);
  }
  static create(value) {
    return new CustomerName(value);
  }
  getValue() {
    return this.value;
  }
}
export class Email {
  constructor(value) {
    if (typeof value !== 'string') invalid('Invalid email');
    const v = value.trim().toLowerCase();
    if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      invalid('Invalid email');
    this.value = v;
    Object.freeze(this);
  }
  static create(value) {
    return new Email(value);
  }
  getValue() {
    return this.value;
  }
}
export class PhoneNumber {
  constructor(value) {
    if (typeof value !== 'string') invalid('Invalid phone number');
    const v = value.replace(/[\s-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(v)) invalid('Invalid phone number');
    this.value = v;
    Object.freeze(this);
  }
  static create(value) {
    return new PhoneNumber(value);
  }
  getValue() {
    return this.value;
  }
}
export class ContactInfo {
  constructor(email, phoneNumber) {
    this.email = email;
    this.phoneNumber = phoneNumber;
    Object.freeze(this);
  }
  static create(email, phoneNumber) {
    return new ContactInfo(
      Email.create(email),
      PhoneNumber.create(phoneNumber),
    );
  }
}
/**
 * A customer's dietary restriction, optionally related to one allergen of the BCK04
 * catalogue (System Specification II.3.1.2) so conflicts with products can be detected.
 */
export class DietaryRestriction {
  constructor(name, description = null, allergenId = null) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
      invalid('Restriction name must contain 1 to 100 characters');
    if (
      description !== null &&
      (typeof description !== 'string' || description.length > 500)
    )
      invalid('Invalid restriction description');
    this.name = name.trim();
    this.description = description?.trim() || null;
    if (allergenId === null || allergenId === undefined) this.allergenId = null;
    else {
      try {
        this.allergenId = AllergenId.create(allergenId).getValue();
      } catch {
        invalid('Restriction allergen id must be an integer between 1 and 14');
      }
    }
    Object.freeze(this);
  }
  static create(name, description, allergenId) {
    return new DietaryRestriction(name, description, allergenId);
  }
  toJSON() {
    return {
      name: this.name,
      description: this.description,
      allergenId: this.allergenId,
    };
  }
}
export class LinkedUserId {
  constructor(value) {
    if (typeof value !== 'string' || !/^USR-\d{5,}$/i.test(value.trim()))
      invalid('Invalid user id');
    this.value = value.trim().toUpperCase();
    Object.freeze(this);
  }
  static create(value) {
    return new LinkedUserId(value);
  }
  getValue() {
    return this.value;
  }
}
export class CustomerSearchCriteria {
  constructor(criteria = {}) {
    this.criteria = Object.fromEntries(
      Object.entries(criteria)
        .filter(([, v]) => typeof v === 'string' && v.trim())
        .map(([k, v]) => [
          k,
          k === 'userId' ? v.trim().toUpperCase() : v.trim(),
        ]),
    );
    Object.freeze(this.criteria);
    Object.freeze(this);
  }
  static create(criteria) {
    return new CustomerSearchCriteria(criteria);
  }
  getValue() {
    return { ...this.criteria };
  }
}
