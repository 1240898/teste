import { jest } from '@jest/globals';
import { PostgresComponentTypeImpactGuard } from '../../../src/modules/pizza-component-type-management/infrastructure/persistence/PostgresComponentTypeImpactGuard.js';
import { PizzaComponentType } from '../../../src/modules/pizza-component-type-management/domain/model/PizzaComponentType.js';
import {
  ComponentTypeId,
  ComponentTypeName,
} from '../../../src/modules/pizza-component-type-management/domain/model/values.js';

const type = ({ min = 0, max = null } = {}) =>
  PizzaComponentType.create(
    ComponentTypeId.create('type-04'),
    ComponentTypeName.create('Topping'),
    4,
    min,
    max,
  );

describe('BCK07 PostgreSQL component type impact guard', () => {
  test('preserves existing configurations when bounds are changed', async () => {
    const tx = { query: jest.fn() };
    const guard = new PostgresComponentTypeImpactGuard();

    await expect(
      guard.assertSafeUpdate(type(), type({ max: 3 }), tx),
    ).resolves.toBeUndefined();

    expect(tx.query).not.toHaveBeenCalled();
  });

  test('new bounds do not block type creation', async () => {
    const tx = { query: jest.fn() };
    const guard = new PostgresComponentTypeImpactGuard();

    await expect(
      guard.assertSafeCreate(type({ min: 1 }), tx),
    ).resolves.toBeUndefined();
    expect(tx.query).not.toHaveBeenCalled();
  });

  test('allows a zero minimum and preserves mandatory-type removal protection', async () => {
    const tx = { query: jest.fn() };
    const guard = new PostgresComponentTypeImpactGuard();

    await expect(guard.assertSafeCreate(type(), tx)).resolves.toBeUndefined();
    await expect(
      guard.assertSafeRemoval(
        PizzaComponentType.create(
          ComponentTypeId.create('type-05'),
          ComponentTypeName.create('Extra'),
          5,
          0,
          null,
        ),
        tx,
      ),
    ).resolves.toBeUndefined();
    await expect(
      guard.assertSafeRemoval(
        PizzaComponentType.create(
          ComponentTypeId.create('type-01'),
          ComponentTypeName.create('Base Dough'),
          1,
          1,
          1,
        ),
        tx,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.query).not.toHaveBeenCalled();
  });
});
