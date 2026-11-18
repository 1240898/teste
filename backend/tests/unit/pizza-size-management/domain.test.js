import { AppError } from '../../../src/shared/errors/AppError.js';
import { PizzaSize } from '../../../src/modules/pizza-size-management/domain/model/PizzaSize.js';
import {
  PizzaSizeId,
  PizzaSizeName,
} from '../../../src/modules/pizza-size-management/domain/model/values.js';

describe('PizzaSize domain', () => {
  test('creates a size with a sequence ID, a trimmed name and active state', () => {
    const size = PizzaSize.create(
      PizzaSizeId.create('psize-0001'),
      PizzaSizeName.create(' Small '),
    );

    expect(size.id.getValue()).toBe('PSIZE-0001');
    expect(size.name.getValue()).toBe('Small');
    expect(size.isActive).toBe(true);
  });

  test.each(['', '   ', 'x'.repeat(51)])(
    'rejects an invalid name: %s',
    (name) => {
      expect(() => PizzaSizeName.create(name)).toThrow(AppError);
    },
  );

  test.each(['S', 'PSIZE-1', 'PSIZE-12x4'])('rejects invalid ID %s', (id) => {
    expect(() => PizzaSizeId.create(id)).toThrow(AppError);
  });

  test('updates its descriptive name without changing its ID', () => {
    const size = PizzaSize.create(
      PizzaSizeId.create('PSIZE-0001'),
      PizzaSizeName.create('Small'),
    );

    size.updateName(PizzaSizeName.create('Personal'));

    expect(size.id.getValue()).toBe('PSIZE-0001');
    expect(size.name.getValue()).toBe('Personal');
  });

  test('activates and deactivates without changing its ID or name', () => {
    const size = PizzaSize.create(
      PizzaSizeId.create('PSIZE-0001'),
      PizzaSizeName.create('Small'),
    );

    size.deactivate();
    expect(size.isActive).toBe(false);
    size.activate();

    expect(size.isActive).toBe(true);
    expect(size.id.getValue()).toBe('PSIZE-0001');
    expect(size.name.getValue()).toBe('Small');
  });
});
