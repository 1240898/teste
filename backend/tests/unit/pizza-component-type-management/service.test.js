import { jest } from '@jest/globals';
import { AppError } from '../../../src/shared/errors/AppError.js';
import { ComponentTypeService } from '../../../src/modules/pizza-component-type-management/application/services/ComponentTypeService.js';
import { PizzaComponentType } from '../../../src/modules/pizza-component-type-management/domain/model/PizzaComponentType.js';
import {
  ComponentTypeId,
  ComponentTypeName,
} from '../../../src/modules/pizza-component-type-management/domain/model/values.js';

const makeType = ({
  id = 'type-a',
  name = 'Topping',
  order = 4,
  min = 0,
  max = 1,
} = {}) =>
  PizzaComponentType.create(
    ComponentTypeId.create(id),
    ComponentTypeName.create(name),
    order,
    min,
    max,
  );

function setup() {
  const state = new Map();
  const repository = {
    findById: jest.fn(async (id) => state.get(id.getValue()) ?? null),
    nextId: jest.fn(async () => 'type-01'),
    search: jest.fn(async (criteria) => {
      let values = [...state.values()];
      if (criteria.id || criteria.name !== undefined)
        values = values.filter(
          (type) =>
            (criteria.id && type.getId().equals(criteria.id)) ||
            (criteria.name !== undefined &&
              type.getName().getValue().toLocaleLowerCase('en-US') ===
                criteria.name.toLocaleLowerCase('en-US')),
        );
      return values;
    }),
    findByIdForUpdate: jest.fn(async (id) => state.get(id.getValue()) ?? null),
    existsByOrder: jest.fn(async (order, excludingId) =>
      [...state.values()].some(
        (type) =>
          type.getAssemblyOrder() === order &&
          type.getId().getValue() !== excludingId?.getValue(),
      ),
    ),
    insert: jest.fn(async (type) => {
      const duplicate = [...state.values()].some(
        (saved) =>
          saved.getName().getValue().toLocaleLowerCase('en-US') ===
          type.getName().getValue().toLocaleLowerCase('en-US'),
      );
      if (duplicate)
        throw new AppError('Component type name already exists', 409);
      state.set(type.getId().getValue(), type);
    }),
    save: jest.fn(async (type) => {
      const duplicate = [...state.values()].some(
        (saved) =>
          saved.getId().getValue() !== type.getId().getValue() &&
          saved.getName().getValue().toLocaleLowerCase('en-US') ===
            type.getName().getValue().toLocaleLowerCase('en-US'),
      );
      if (duplicate)
        throw new AppError('Component type name already exists', 409);
      state.set(type.getId().getValue(), type);
    }),
    delete: jest.fn(async (id) => state.delete(id.getValue())),
  };
  const impact = {
    assertSafeCreate: jest.fn(async () => {}),
    assertSafeUpdate: jest.fn(async () => {}),
    assertSafeRemoval: jest.fn(async () => {}),
  };
  const unitOfWork = { withTransaction: jest.fn(async (work) => work({})) };
  const service = new ComponentTypeService(repository, unitOfWork, impact);
  return { service, repository, impact, state, unitOfWork };
}

describe('BCK07 component type application service', () => {
  test('creates a type after checking order, name and impact', async () => {
    const { service, repository, impact } = setup();
    const result = await service.create({
      name: 'Extra',
      assemblyOrder: 5,
      minQuantity: 0,
      maxQuantity: null,
    });
    expect(result).toMatchObject({
      id: 'type-01',
      name: 'Extra',
      assemblyOrder: 5,
      minQuantity: 0,
      maxQuantity: null,
    });
    expect(result.id).toBeTruthy();
    expect(repository.insert).toHaveBeenCalledTimes(1);
    expect(impact.assertSafeCreate).toHaveBeenCalledTimes(1);
  });

  test('rejects duplicate order and duplicate name without writing', async () => {
    const { service, repository, state } = setup();
    state.set('type-a', makeType());
    await expect(
      service.create({
        name: 'Another',
        assemblyOrder: 4,
        minQuantity: 0,
        maxQuantity: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.insert).not.toHaveBeenCalled();
    await expect(
      service.create({
        name: 'tOPPING',
        assemblyOrder: 5,
        minQuantity: 0,
        maxQuantity: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.insert).toHaveBeenCalledTimes(1);
    expect(state.size).toBe(1);
  });

  test('returns all types, exact case-insensitive name matches, and OR results', async () => {
    const { service, state } = setup();
    state.set('type-a', makeType());
    state.set('type-b', makeType({ id: 'type-b', name: 'Cheese', order: 3 }));
    expect(await service.search({})).toHaveLength(2);
    expect(await service.search({ name: 'tOPPING' })).toMatchObject([
      { id: 'type-a' },
    ]);
    expect(await service.search({ id: 'type-a', name: 'Cheese' })).toHaveLength(
      2,
    );
  });

  test('updates only present fields and preserves ID, including null and zero', async () => {
    const { service, state } = setup();
    state.set('type-a', makeType());
    const changed = await service.update(ComponentTypeId.create('type-a'), {
      maxQuantity: null,
      minQuantity: 0,
    });
    expect(changed).toMatchObject({
      id: 'type-a',
      name: 'Topping',
      assemblyOrder: 4,
      minQuantity: 0,
      maxQuantity: null,
    });
    const finiteZero = await service.update(ComponentTypeId.create('type-a'), {
      maxQuantity: 0,
    });
    expect(finiteZero.maxQuantity).toBe(0);
  });

  test('allows its own assembly order but rejects another type order', async () => {
    const { service, repository, state } = setup();
    state.set('type-a', makeType());
    const unchanged = await service.update(ComponentTypeId.create('type-a'), {
      assemblyOrder: 4,
    });
    expect(unchanged.assemblyOrder).toBe(4);
    state.set('type-b', makeType({ id: 'type-b', name: 'Cheese', order: 3 }));
    await expect(
      service.update(ComponentTypeId.create('type-b'), { assemblyOrder: 4 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid merged bounds without saving', async () => {
    const { service, repository, state } = setup();
    state.set('type-a', makeType());
    await expect(
      service.update(ComponentTypeId.create('type-a'), { minQuantity: 2 }),
    ).rejects.toBeInstanceOf(AppError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  test('rejects failed impact checks before writing or deleting', async () => {
    const { service, repository, impact, state } = setup();
    state.set('type-a', makeType());
    const failure = new AppError('Unsafe reference impact', 409);
    impact.assertSafeUpdate.mockRejectedValue(failure);
    await expect(
      service.update(ComponentTypeId.create('type-a'), { maxQuantity: 2 }),
    ).rejects.toBe(failure);
    expect(repository.save).not.toHaveBeenCalled();
    impact.assertSafeRemoval.mockRejectedValue(failure);
    await expect(service.remove(ComponentTypeId.create('type-a'))).rejects.toBe(
      failure,
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });

  test('returns not found for absent IDs and deletes safe unreferenced types', async () => {
    const { service, state, repository } = setup();
    await expect(
      service.getById(ComponentTypeId.create('missing')),
    ).rejects.toMatchObject({ status: 404 });
    state.set('type-a', makeType());
    await expect(
      service.remove(ComponentTypeId.create('type-a')),
    ).resolves.toBe(undefined);
    expect(repository.delete).toHaveBeenCalledTimes(1);
  });
});
