import { Customer } from '../../domain/model/Customer.js';
import {
  CustomerId,
  CustomerName,
  ContactInfo,
  DietaryRestriction,
  HealthDataConsent,
  LinkedUserId,
} from '../../domain/model/values.js';
export class CustomerMapper {
  static toDomain(row) {
    const consent = HealthDataConsent.restore(
      row.health_data_consent_given ?? false,
      row.health_data_consent_timestamp ?? null,
    );
    return Customer.restore({
      id: CustomerId.create(row.id),
      name: CustomerName.create(row.name),
      contactInfo: ContactInfo.create(row.email, row.phone_number),
      dietaryRestrictions: consent.isGiven()
        ? row.dietary_restrictions.map((x) =>
            DietaryRestriction.create(
              x.name,
              x.description,
              x.allergenId ?? null,
            ),
          )
        : [],
      userId: row.user_id ? LinkedUserId.create(row.user_id) : null,
      active: row.active,
      healthDataConsent: consent,
    });
  }
  static toPersistence(c) {
    return {
      id: c.id.getValue(),
      name: c.name.getValue(),
      email: c.contactInfo.email.getValue(),
      phoneNumber: c.contactInfo.phoneNumber.getValue(),
      dietaryRestrictions: JSON.stringify(
        c.dietaryRestrictions.map((x) => x.toJSON()),
      ),
      // Mirrored into customer_dietary_restriction_allergens (FK to allergens).
      restrictionAllergens: c.dietaryRestrictions
        .filter((x) => x.allergenId !== null)
        .map((x) => ({ restriction: x.name, allergenId: x.allergenId })),
      userId: c.userId?.getValue() ?? null,
      active: c.active,
      healthDataConsentGiven: c.healthDataConsent.isGiven(),
      healthDataConsentTimestamp: c.healthDataConsent.timestamp,
    };
  }
}
