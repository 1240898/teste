import { AppError } from '../../../src/shared/errors/AppError.js';
import { PizzaComponentType } from '../../../src/modules/pizza-component-type-management/domain/model/PizzaComponentType.js';
import {
  ComponentTypeId,
  ComponentTypeName,
} from '../../../src/modules/pizza-component-type-management/domain/model/values.js';

const makeType = ({
  id = 'stable-id',
  name = 'Topping',
  order = 4,
  min = 0,
  max = null,
} = {}) =>
  PizzaComponentType.create(
    ComponentTypeId.create(id),
    ComponentTypeName.create(name),
    order,
    min,
    max,
  );

describe('BCK07 domain model', () => {
  test.each([
    [0, 0],
    [1, 1],
    [2, null],
  ])('accepts min=%p and max=%p', (min, max) => {
    const type = makeType({ min, max });
    expect(type.getMinQuantity()).toBe(min);
    expect(type.getMaxQuantity()).toBe(max);
  });

  test.each([
    [-1, null],
    [0.5, null],
    [0, -1],
    [2, 1],
    [0, 1.5],
  ])('rejects invalid bounds min=%p and max=%p', (min, max) => {
    expect(() => makeType({ min, max })).toThrow(AppError);
  });

  test.each([0, -1, 1.5, '1'])('rejects assembly order %p', (order) => {
    expect(() => makeType({ order })).toThrow(AppError);
  });

  test('preserves readable IDs and requires an explicit value', () => {
    expect(ComponentTypeId.create('type-01').getValue()).toBe('type-01');
    expect(ComponentTypeId.create('type-a').getValue()).toBe('type-a');
    expect(() => ComponentTypeId.create()).toThrow(AppError);
  });

  test('trims names and rejects empty names', () => {
    expect(ComponentTypeName.create('  Cheese  ').getValue()).toBe('Cheese');
    expect(() => ComponentTypeName.create('  ')).toThrow(AppError);
  });

  test('revises without changing identity or the original state', () => {
    const original = makeType();
    const revised = original.revised(
      ComponentTypeName.create('Cheese'),
      3,
      0,
      1,
    );
    expect(revised.getId().getValue()).toBe('stable-id');
    expect(revised.getName().getValue()).toBe('Cheese');
    expect(original.getName().getValue()).toBe('Topping');
    expect(() =>
      original.revised(ComponentTypeName.create('Invalid'), 3, 2, 1),
    ).toThrow(AppError);
    expect(original.getMinQuantity()).toBe(0);
    expect(original.getMaxQuantity()).toBeNull();
  });
});
