import { jest } from '@jest/globals';
import { PizzaSize } from '../../../src/modules/pizza-size-management/domain/model/PizzaSize.js';
import {
  PizzaSizeId,
  PizzaSizeName,
} from '../../../src/modules/pizza-size-management/domain/model/values.js';
import { PizzaSizeService } from '../../../src/modules/pizza-size-management/application/services/PizzaSizeService.js';

const size = (id, name) =>
  PizzaSize.create(PizzaSizeId.create(id), PizzaSizeName.create(name));

describe('PizzaSizeService', () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = {
      nextId: jest.fn().mockResolvedValue('PSIZE-0001'),
      findById: jest.fn(),
      findByName: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (value) => value),
      search: jest.fn().mockResolvedValue([]),
      isReferencedByOtherEntities: jest.fn().mockResolvedValue(false),
      delete: jest.fn(),
    };
    service = new PizzaSizeService(repository);
  });

  test('creates a size with its database-generated identifier', async () => {
    await expect(service.create({ name: 'Small' })).resolves.toMatchObject({
      id: 'PSIZE-0001',
      name: 'Small',
      active: true,
    });
    expect(repository.nextId).toHaveBeenCalledTimes(1);
  });

  test('rejects a duplicate name', async () => {
    repository.findByName.mockResolvedValue(size('PSIZE-0002', 'Small'));
    await expect(service.create({ name: 'small' })).rejects.toMatchObject({
      status: 409,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  test('returns 404 when an ID is not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.getById('PSIZE-0001')).rejects.toMatchObject({
      status: 404,
    });
  });

  test('blocks deletion of a referenced size', async () => {
    repository.findById.mockResolvedValue(size('PSIZE-0001', 'Small'));
    repository.isReferencedByOtherEntities.mockResolvedValue(true);
    await expect(service.delete('PSIZE-0001')).rejects.toMatchObject({
      status: 409,
    });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  test('updates a size without allowing its ID to change', async () => {
    repository.findById.mockResolvedValue(size('PSIZE-0001', 'Small'));
    await expect(
      service.update('PSIZE-0001', { name: 'Personal' }),
    ).resolves.toMatchObject({ id: 'PSIZE-0001', name: 'Personal' });
  });

  test('updates active status without requiring a name', async () => {
    repository.findById.mockResolvedValue(size('PSIZE-0001', 'Small'));

    await expect(
      service.update('PSIZE-0001', { active: false }),
    ).resolves.toMatchObject({ id: 'PSIZE-0001', name: 'Small', active: false });
  });

  test('passes active search filters to the repository', async () => {
    await service.search({ active: false });
    expect(repository.search).toHaveBeenCalledWith({ active: false });
  });
});
