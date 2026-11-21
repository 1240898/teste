import { AppError } from '../../../../shared/errors/AppError.js';
import {
  CustomerId,
  CustomerName,
  ContactInfo,
  DietaryRestriction,
  HealthDataConsent,
  LinkedUserId,
} from './values.js';

export const HEALTH_DATA_CONSENT_REQUIRED =
  'Explicit consent is required to store allergen or dietary information';

const toRestriction = (value) =>
  value instanceof DietaryRestriction
    ? value
    : DietaryRestriction.create(
        value.name,
        value.description,
        value.allergenId,
      );

export class Customer {
  constructor({
    id,
    name,
    contactInfo,
    dietaryRestrictions = [],
    userId = null,
    active = true,
    healthDataConsent = HealthDataConsent.none(),
  }) {
    Object.assign(this, {
      id,
      name,
      contactInfo,
      dietaryRestrictions,
      userId,
      active,
      healthDataConsent,
    });
    this.validateInvariants();
  }
  static create(
    id,
    name,
    contactInfo,
    restrictions = [],
    userId = null,
    healthDataConsent = HealthDataConsent.none(),
  ) {
    return new Customer({
      id,
      name,
      contactInfo,
      dietaryRestrictions: restrictions,
      userId,
      healthDataConsent,
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
  hasHealthDataConsent() {
    return this.healthDataConsent.isGiven();
  }
  /** GDP01: explicit consent given by the customer (Art. 9(2)(a)). */
  giveHealthDataConsent(now = new Date()) {
    if (!this.healthDataConsent.isGiven())
      this.healthDataConsent = HealthDataConsent.grant(now);
  }
  /** GDP01: withdrawing consent erases the health data it covered (Art. 7(3)). */
  withdrawHealthDataConsent(now = new Date()) {
    this.healthDataConsent = HealthDataConsent.withdraw(now);
    this.dietaryRestrictions = [];
  }
  addDietaryRestriction(value) {
    const r = toRestriction(value);
    if (
      this.dietaryRestrictions.some(
        (x) => x.name.toLowerCase() === r.name.toLowerCase(),
      )
    )
      return;
    this.#requireConsent();
    this.dietaryRestrictions.push(r);
  }
  removeDietaryRestriction(name) {
    this.dietaryRestrictions = this.dietaryRestrictions.filter(
      (x) => x.name.toLowerCase() !== name.toLowerCase(),
    );
  }
  replaceDietaryRestrictions(values) {
    const next = values.map(toRestriction);
    if (next.length) this.#requireConsent();
    this.dietaryRestrictions = next;
    this.validateInvariants();
  }
  /**
   * GDP01: self-service allergen selection. Restrictions linked to an allergen are
   * replaced; restrictions without an allergen (recorded by the Manager) are kept.
   */
  replaceAllergenRestrictions(values) {
    const allergens = values.map(toRestriction);
    if (allergens.some((x) => x.allergenId === null))
      throw new AppError(
        'Every selected restriction must reference an allergen',
        400,
      );
    if (allergens.length) this.#requireConsent();
    const others = this.dietaryRestrictions.filter(
      (x) => x.allergenId === null,
    );
    this.dietaryRestrictions = [
      ...others,
      ...allergens.filter(
        (x) =>
          !others.some((o) => o.name.toLowerCase() === x.name.toLowerCase()),
      ),
    ];
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
      !(this.contactInfo instanceof ContactInfo) ||
      !(this.healthDataConsent instanceof HealthDataConsent)
    )
      throw new TypeError('Invalid Customer aggregate');
    if (this.dietaryRestrictions.length) this.#requireConsent();
    const names = this.dietaryRestrictions.map((x) => x.name.toLowerCase());
    if (new Set(names).size !== names.length)
      throw new AppError('Duplicate dietary restriction', 400);
  }
  #requireConsent() {
    if (!this.healthDataConsent.isGiven())
      throw new AppError(HEALTH_DATA_CONSENT_REQUIRED, 400);
  }
}
