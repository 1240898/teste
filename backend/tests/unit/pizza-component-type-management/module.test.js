import { jest } from '@jest/globals';
import { createPizzaComponentTypeModule } from '../../../src/modules/pizza-component-type-management/index.js';
import { PizzaComponentType } from '../../../src/modules/pizza-component-type-management/domain/model/PizzaComponentType.js';
import {
  ComponentTypeId,
  ComponentTypeName,
} from '../../../src/modules/pizza-component-type-management/domain/model/values.js';

test('requires a database or explicit persistence adapters', () => {
  expect(() =>
    createPizzaComponentTypeModule({
      authMiddleware: { verifyToken() {} },
    }),
  ).toThrow('database or component type repository');
});

test('the default impact guard lets cardinality updates through without re-validating stored compositions', async () => {
  const current = PizzaComponentType.create(
    ComponentTypeId.create('type-05'),
    ComponentTypeName.create('Extra'),
    5,
    0,
    5,
  );
  const repository = {
    findByIdForUpdate: jest.fn(async () => current),
    existsByOrder: jest.fn(async () => false),
    save: jest.fn(),
  };
  const tx = { query: jest.fn() };
  const { service, impactGuard } = createPizzaComponentTypeModule({
    repository,
    unitOfWork: { withTransaction: (work) => work(tx) },
    authMiddleware: { verifyToken() {} },
  });

  // Tightening the maximum (5 -> 3) is accepted: stored predefined pizza
  // compositions are preserved and only new or replaced compositions are
  // validated against the new bounds (BCK10).
  await expect(
    service.update(ComponentTypeId.create('type-05'), { maxQuantity: 3 }),
  ).resolves.toMatchObject({ maxQuantity: 3 });

  expect(impactGuard.assertSafeUpdate).toBeDefined();
  expect(tx.query).not.toHaveBeenCalled();
  expect(repository.save).toHaveBeenCalledTimes(1);
});

test('default impact guard protects the four mandatory seeded types only', async () => {
  const type = (id) =>
    PizzaComponentType.create(
      ComponentTypeId.create(id),
      ComponentTypeName.create(`Type ${id}`),
      1,
      0,
      null,
    );
  const types = new Map(
    ['type-01', 'type-02', 'type-03', 'type-04', 'type-05'].map((id) => [
      id,
      type(id),
    ]),
  );
  const repository = {
    findByIdForUpdate: jest.fn(async (id) => types.get(id.getValue())),
    delete: jest.fn(),
  };
  const { service } = createPizzaComponentTypeModule({
    repository,
    unitOfWork: { withTransaction: (work) => work({}) },
    authMiddleware: { verifyToken() {} },
  });

  for (const id of ['type-01', 'type-02', 'type-03', 'type-04']) {
    await expect(
      service.remove(ComponentTypeId.create(id)),
    ).rejects.toMatchObject({ status: 409 });
  }
  expect(repository.delete).not.toHaveBeenCalled();
  await expect(service.remove(ComponentTypeId.create('type-05'))).resolves.toBe(
    undefined,
  );
  expect(repository.delete).toHaveBeenCalledWith(
    ComponentTypeId.create('type-05'),
    expect.anything(),
  );
});
