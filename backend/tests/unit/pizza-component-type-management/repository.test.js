import { jest } from '@jest/globals';
import { PostgresComponentTypeRepository } from '../../../src/modules/pizza-component-type-management/infrastructure/persistence/PostgresComponentTypeRepository.js';
import { AppError } from '../../../src/shared/errors/AppError.js';
import { ComponentTypeSearchCriteria } from '../../../src/modules/pizza-component-type-management/domain/model/ComponentTypeSearchCriteria.js';
import { ComponentTypeId } from '../../../src/modules/pizza-component-type-management/domain/model/values.js';
import { ComponentTypeName } from '../../../src/modules/pizza-component-type-management/domain/model/values.js';
import { PizzaComponentType } from '../../../src/modules/pizza-component-type-management/domain/model/PizzaComponentType.js';

describe('BCK07 PostgreSQL repository contract', () => {
  test('searches exact names case-insensitively and combines ID/name with OR', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new PostgresComponentTypeRepository(database);
    await repository.search(
      new ComponentTypeSearchCriteria({
        id: ComponentTypeId.create('type-id'),
        name: 'Topping',
      }),
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('id = $1 OR lower(name) = lower($2)'),
      ['type-id', 'Topping'],
    );
  });

  test('lists all types when search criteria are empty', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new PostgresComponentTypeRepository(database);
    await repository.search(new ComponentTypeSearchCriteria());
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'FROM pizza_component_types  ORDER BY assembly_order, id',
      ),
      [],
    );
  });

  test('maps known unique and foreign-key conflicts to 409', async () => {
    const database = {};
    const repository = new PostgresComponentTypeRepository(database);
    const tx = {
      query: jest.fn().mockRejectedValue({
        code: '23505',
        constraint: 'pizza_component_types_name_ci_key',
      }),
    };
    const type = PizzaComponentType.create(
      ComponentTypeId.create('type-id'),
      ComponentTypeName.create('Topping'),
      4,
      0,
      null,
    );
    await expect(repository.insert(type, tx)).rejects.toMatchObject({
      status: 409,
    });
    const deleteTx = {
      query: jest.fn().mockRejectedValue({ code: '23503' }),
    };
    await expect(
      repository.delete(ComponentTypeId.create('type-id'), deleteTx),
    ).rejects.toBeInstanceOf(AppError);
  });
});
