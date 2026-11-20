import { jest } from '@jest/globals';
import { CustomerService } from '../../../src/modules/customer-management/application/services/CustomerService.js';
import { Customer } from '../../../src/modules/customer-management/domain/model/Customer.js';
import {
  ContactInfo,
  CustomerId,
  CustomerName,
  DietaryRestriction,
} from '../../../src/modules/customer-management/domain/model/values.js';

const userId = 'USR-00001';
const dto = (overrides = {}) => ({
  name: 'Ana Silva',
  email: ' ANA@example.com ',
  phoneNumber: '+351 912-345-678',
  dietaryRestrictions: [{ name: 'Lactose', description: 'Avoid dairy' }],
  ...overrides,
});
const makeCustomer = (id = 'CUST-0001', values = {}) =>
  Customer.create(
    CustomerId.create(id),
    CustomerName.create(values.name ?? 'Ana Silva'),
    ContactInfo.create(
      values.email ?? 'ana@example.com',
      values.phoneNumber ?? '+351912345678',
    ),
    (values.dietaryRestrictions ?? []).map((restriction) =>
      DietaryRestriction.create(restriction.name, restriction.description),
    ),
    values.userId ?? null,
  );

function setup() {
  const customer = makeCustomer();
  const repository = {
    nextId: jest.fn().mockResolvedValue('CUST-0001'),
    findById: jest.fn().mockResolvedValue(customer),
    findByEmail: jest.fn().mockResolvedValue(null),
    existsByEmail: jest.fn().mockResolvedValue(false),
    findByUserId: jest.fn().mockResolvedValue(null),
    search: jest.fn().mockResolvedValue([customer]),
    save: jest.fn().mockImplementation(async (value) => value),
  };
  const userDirectory = {
    findById: jest.fn().mockResolvedValue({
      email: 'ana@example.com',
      active: true,
      roles: ['CUSTOMER'],
    }),
  };
  return {
    customer,
    repository,
    userDirectory,
    service: new CustomerService(repository, userDirectory),
  };
}

describe('BCK02 CustomerService', () => {
  test('creates normalized customer data and maps it to the response DTO', async () => {
    const { service, repository } = setup();
    const result = await service.create(dto());
    expect(result).toMatchObject({
      id: 'CUST-0001',
      name: 'Ana Silva',
      email: 'ana@example.com',
      phoneNumber: '+351912345678',
      dietaryRestrictions: [{ name: 'Lactose', description: 'Avoid dairy' }],
      userId: null,
      active: true,
    });
    expect(repository.existsByEmail).toHaveBeenCalledWith('ana@example.com');
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  test('rejects duplicate email before saving', async () => {
    const { service, repository } = setup();
    repository.existsByEmail.mockResolvedValue(true);
    await expect(service.create(dto())).rejects.toMatchObject({ status: 409 });
    expect(repository.save).not.toHaveBeenCalled();
  });

  test('validates a linked user and prevents linking one user to multiple customers', async () => {
    const { service, repository, userDirectory } = setup();
    userDirectory.findById.mockResolvedValue(null);
    await expect(service.create(dto({ userId }))).rejects.toMatchObject({
      status: 400,
    });
    userDirectory.findById.mockResolvedValue({
      email: 'ana@example.com',
      active: true,
      roles: ['CUSTOMER'],
    });
    repository.findByUserId.mockResolvedValue(makeCustomer('CUST-0002'));
    await expect(service.create(dto({ userId }))).rejects.toMatchObject({
      status: 409,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  test.each([
    [{ email: 'ana@example.com', active: false, roles: ['CUSTOMER'] }],
    [{ email: 'ana@example.com', active: true, roles: ['EMPLOYEE'] }],
  ])('rejects an inactive or non-Customer linked user', async (user) => {
    const { service, userDirectory, repository } = setup();
    userDirectory.findById.mockResolvedValue(user);
    await expect(service.create(dto({ userId }))).rejects.toMatchObject({
      status: 400,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  test('updates customer attributes and allows retaining its own email and user link', async () => {
    const { service, customer, repository, userDirectory } = setup();
    customer.linkUser(userId);
    repository.findByEmail.mockResolvedValue(customer);
    repository.findByUserId.mockResolvedValue(customer);
    const result = await service.update(
      'CUST-0001',
      dto({
        name: 'Ana Costa',
        email: 'ana@example.com',
        phoneNumber: '+351913456789',
        userId,
        dietaryRestrictions: [{ name: 'Gluten' }],
      }),
    );
    expect(result).toMatchObject({
      name: 'Ana Costa',
      phoneNumber: '+351913456789',
      dietaryRestrictions: [{ name: 'Gluten', description: null }],
      userId,
    });
    expect(userDirectory.findById).toHaveBeenCalledWith(userId);
    expect(repository.save).toHaveBeenCalledWith(customer);
  });

  test('rejects update collisions and missing customers', async () => {
    const { service, repository } = setup();
    repository.findByEmail.mockResolvedValue(makeCustomer('CUST-0002'));
    await expect(service.update('CUST-0001', dto())).rejects.toMatchObject({
      status: 409,
    });
    repository.findById.mockResolvedValue(null);
    await expect(service.update('CUST-0001', dto())).rejects.toMatchObject({
      status: 404,
    });
  });

  test('gets and searches customers, then toggles active state', async () => {
    const { service, customer, repository } = setup();
    const manager = { sub: 'USR-00001', roles: ['MANAGER'] };
    expect((await service.getById('CUST-0001', manager)).id).toBe('CUST-0001');
    expect(await service.search({ name: ' Ana ' })).toHaveLength(1);
    expect(repository.search).toHaveBeenCalledWith({ name: 'Ana' });
    await service.deactivate('CUST-0001');
    expect(customer.active).toBe(false);
    await service.activate('CUST-0001');
    expect(customer.active).toBe(true);
    repository.findById.mockResolvedValue(null);
    await expect(service.getById('CUST-0001', manager)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.deactivate('CUST-0001')).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.activate('CUST-0001')).rejects.toMatchObject({
      status: 404,
    });
  });
});
