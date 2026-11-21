import { Customer } from '../../../src/modules/customer-management/domain/model/Customer.js';
import {
  ContactInfo,
  CustomerId,
  CustomerName,
  CustomerSearchCriteria,
  DietaryRestriction,
  LinkedUserId,
  HealthDataConsent,
} from '../../../src/modules/customer-management/domain/model/values.js';

const createCustomer = (restrictions = []) =>
  Customer.create(
    CustomerId.create('CUST-0001'),
    CustomerName.create(' Ana Silva '),
    ContactInfo.create(' ANA@example.com ', '+351 912-345-678'),
    restrictions,
    null, 
    HealthDataConsent.grant(),
  );

describe('BCK02 customer domain', () => {
  test('normalizes identifier and customer contact values', () => {
    expect(CustomerId.create('cust-1234').getValue()).toBe('CUST-1234');
    expect(CustomerName.create(' Ana Silva ').getValue()).toBe('Ana Silva');
    const contact = ContactInfo.create(' ANA@example.com ', '+351 912-345-678');
    expect(contact.email.getValue()).toBe('ana@example.com');
    expect(contact.phoneNumber.getValue()).toBe('+351912345678');
  });

  test.each(['CUST-123', 'CUSTOMER-0001', '', null])(
    'rejects invalid customer identifier %p',
    (id) => {
      expect(() => CustomerId.create(id)).toThrow();
    },
  );

  test.each(['', '   ', 'a'.repeat(101), null])(
    'rejects invalid customer name %p',
    (name) => {
      expect(() => CustomerName.create(name)).toThrow();
    },
  );

  test.each(['invalid', 'a@b', 'a'.repeat(250) + '@example.com'])(
    'rejects invalid email %p',
    (email) => {
      expect(() => ContactInfo.create(email, '+351912345678')).toThrow();
    },
  );

  test.each(['912345678', '+012345678', '+123', null])(
    'rejects invalid phone number %p',
    (phone) => {
      expect(() => ContactInfo.create('ana@example.com', phone)).toThrow();
    },
  );

  test('normalizes and manages dietary restrictions without case-insensitive duplicates', () => {
    const customer = createCustomer([
      DietaryRestriction.create(' Lactose ', ' Avoid dairy '),
    ]);
    customer.addDietaryRestriction({ name: 'lactose', description: 'Other' });
    customer.addDietaryRestriction({ name: 'Gluten' });
    expect(customer.dietaryRestrictions.map((item) => item.toJSON())).toEqual([
      { name: 'Lactose', description: 'Avoid dairy', allergenId: null },
      { name: 'Gluten', description: null, allergenId: null },
    ]);
    customer.removeDietaryRestriction('GLUTEN');
    expect(customer.dietaryRestrictions.map((item) => item.name)).toEqual([
      'Lactose',
    ]);
    expect(() =>
      customer.replaceDietaryRestrictions([
        { name: 'Gluten' },
        { name: 'gluten' },
      ]),
    ).toThrow('Duplicate dietary restriction');
  });

  test('supports linking a user, activation state and normalized search criteria', () => {
    const customer = createCustomer();
    customer.linkUser(LinkedUserId.create(' usr-00001 '));
    customer.deactivate();
    expect(customer.userId.getValue()).toBe('USR-00001');
    expect(customer.active).toBe(false);
    customer.unlinkUser();
    customer.activate();
    expect(customer.userId).toBeNull();
    expect(customer.active).toBe(true);
    expect(
      CustomerSearchCriteria.create({
        name: ' Ana ',
        email: '',
        userId: ' usr-00001 ',
        unknown: 2,
      }).getValue(),
    ).toEqual({ name: 'Ana', userId: 'USR-00001' });
  });

  test.each(['user-1', 'USR-1234', 'USR-ABCDE', ''])(
    'rejects invalid linked user identifier %p',
    (id) => {
      expect(() => LinkedUserId.create(id)).toThrow();
    },
  );

    test('a dietary restriction may relate to one EU allergen (1..14)', () => {
    expect(DietaryRestriction.create('Lactose', null, 7).toJSON()).toEqual({
      name: 'Lactose',
      description: null,
      allergenId: 7,
    });
    expect(DietaryRestriction.create('Vegan').allergenId).toBeNull();
    for (const invalid of [0, 15, 1.5, 'abc'])
      expect(() =>
        DietaryRestriction.create('Lactose', null, invalid),
      ).toThrow('Restriction allergen id must be an integer between 1 and 14');
  });
});
