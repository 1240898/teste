import { Customer } from '../../../src/modules/customer-management/domain/model/Customer.js';
import {
  ContactInfo,
  CustomerId,
  CustomerName,
  DietaryRestriction,
} from '../../../src/modules/customer-management/domain/model/values.js';
import { CustomerMapper } from '../../../src/modules/customer-management/infrastructure/persistence/CustomerMapper.js';

describe('BCK02 customer persistence mapping', () => {
  test('round-trips customer fields through the persistence mapper', () => {
    const customer = Customer.create(
      CustomerId.create('CUST-0001'),
      CustomerName.create('Ana Silva'),
      ContactInfo.create('ana@example.com', '+351912345678'),
      [DietaryRestriction.create('Lactose', 'Avoid dairy')],
    );

    const persisted = CustomerMapper.toPersistence(customer);
    expect(persisted).toMatchObject({
      id: 'CUST-0001',
      name: 'Ana Silva',
      email: 'ana@example.com',
      phoneNumber: '+351912345678',
    });

    const restored = CustomerMapper.toDomain({
      id: persisted.id,
      name: persisted.name,
      email: persisted.email,
      phone_number: persisted.phoneNumber,
      dietary_restrictions: JSON.parse(persisted.dietaryRestrictions),
      user_id: null,
      active: true,
    });
    expect(restored.dietaryRestrictions.map((item) => item.toJSON())).toEqual([
      { name: 'Lactose', description: 'Avoid dairy', allergenId: null },
    ]);
  });
});
