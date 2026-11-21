import { Customer } from '../../../src/modules/customer-management/domain/model/Customer.js';
import {
  ContactInfo,
  CustomerId,
  CustomerName,
  DietaryRestriction,
  HealthDataConsent,
} from '../../../src/modules/customer-management/domain/model/values.js';
import { CustomerMapper } from '../../../src/modules/customer-management/infrastructure/persistence/CustomerMapper.js';

describe('BCK02 customer persistence mapping', () => {
  test('round-trips customer fields through the persistence mapper', () => {
    const customer = Customer.create(
      CustomerId.create('CUST-0001'),
      CustomerName.create('Ana Silva'),
      ContactInfo.create('ana@example.com', '+351912345678'),
      [DietaryRestriction.create('Lactose', 'Avoid dairy')],
      null, 
      HealthDataConsent.grant(new Date('2026-11-15T10:00:00.000Z')),
    );

    const persisted = CustomerMapper.toPersistence(customer);
    expect(persisted).toMatchObject({
      id: 'CUST-0001',
      name: 'Ana Silva',
      email: 'ana@example.com',
      phoneNumber: '+351912345678',
      healthDataConsentGiven: true, 
      healthDataConsentTimestamp: new Date('2026-11-15T10:00:00.000Z'),
    });

    const restored = CustomerMapper.toDomain({
      id: persisted.id,
      name: persisted.name,
      email: persisted.email,
      phone_number: persisted.phoneNumber,
      dietary_restrictions: JSON.parse(persisted.dietaryRestrictions),
      user_id: null,
      active: true,
      health_data_consent_given: persisted.healthDataConsentGiven, 
      health_data_consent_timestamp: persisted.healthDataConsentTimestamp,
    });
    expect(restored.dietaryRestrictions.map((item) => item.toJSON())).toEqual([
      { name: 'Lactose', description: 'Avoid dairy', allergenId: null },
    ]);
  });
});
