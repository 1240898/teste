import { jest } from '@jest/globals';
import { AppError } from '../../../src/shared/errors/AppError.js';
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
  test('checks stored predefined pizza component counts against candidate bounds', async () => {
    const tx = {
      query: jest.fn().mockResolvedValue({ rows: [{ invalid: false }] }),
    };
    const guard = new PostgresComponentTypeImpactGuard();

    await expect(
      guard.assertSafeUpdate(type(), type({ max: 3 }), tx),
    ).resolves.toBeUndefined();

    expect(tx.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /product_composition_items[\s\S]*pizza_component_type_id/i,
      ),
      ['type-04', 0, 3],
    );
  });

  test('returns 409 when a stored predefined pizza would exceed the new maximum', async () => {
    const tx = {
      query: jest.fn().mockResolvedValue({ rows: [{ invalid: true }] }),
    };
    const guard = new PostgresComponentTypeImpactGuard();

    await expect(
      guard.assertSafeUpdate(type(), type({ max: 0 }), tx),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/predefined pizza/i),
    });
  });

  test('returns 409 when a stored predefined pizza would fall below the new minimum', async () => {
    const tx = {
      query: jest.fn().mockResolvedValue({ rows: [{ invalid: true }] }),
    };
    const guard = new PostgresComponentTypeImpactGuard();

    await expect(
      guard.assertSafeUpdate(type(), type({ min: 2 }), tx),
    ).rejects.toBeInstanceOf(AppError);
    expect(tx.query.mock.calls[0][1]).toEqual(['type-04', 2, null]);
  });

  test('does not query BCK10 when cardinality bounds are unchanged', async () => {
    const tx = { query: jest.fn() };
    const guard = new PostgresComponentTypeImpactGuard();

    await guard.assertSafeUpdate(type(), type(), tx);

    expect(tx.query).not.toHaveBeenCalled();
  });

  test('preserves the existing create and removal protections', async () => {
    const tx = { query: jest.fn() };
    const guard = new PostgresComponentTypeImpactGuard();

    await expect(
      guard.assertSafeCreate(type({ min: 1 }), tx),
    ).rejects.toMatchObject({
      status: 409,
    });
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
