import { CategoryId } from '../../../src/modules/product-category-management/domain/model/CategoryId.js';
import { CategoryName } from '../../../src/modules/product-category-management/domain/model/CategoryName.js';
import { ProductCategory } from '../../../src/modules/product-category-management/domain/model/ProductCategory.js';

describe('CategoryName (BCK03 BR1)', () => {
  test('UT01 accepts a valid name and normalises whitespace', () => {
    expect(CategoryName.create('  Soft   Drinks ').getValue()).toBe(
      'Soft Drinks',
    );
  });
  test.each(['', '   ', '\t\n'])('UT02 rejects blank name %j', (value) => {
    expect(() => CategoryName.create(value)).toThrow(
      /Category name cannot be empty/i,
    );
  });
  test.each([undefined, null, 42, {}, []])('rejects non-text %j', (value) => {
    expect(() => CategoryName.create(value)).toThrow(/must be text/i);
  });
  test('rejects names above 100 characters but accepts exactly 100', () => {
    expect(CategoryName.create('a'.repeat(100)).getValue()).toHaveLength(100);
    expect(() => CategoryName.create('a'.repeat(101))).toThrow(/exceed 100/i);
  });
  test('rejects control characters', () => {
    expect(() => CategoryName.create('Bev\u0000erages')).toThrow(
      /invalid characters/i,
    );
  });
  test('equality is case-insensitive', () => {
    expect(
      CategoryName.create('Pizzas').equals(CategoryName.create('pIZZAS')),
    ).toBe(true);
    expect(
      CategoryName.create('Pizzas').equals(CategoryName.create('Drinks')),
    ).toBe(false);
  });
});

describe('CategoryId', () => {
  test('accepts CAT-NNNNN identifiers (also beyond 5 digits) and uppercases', () => {
    expect(CategoryId.create('cat-00123').getValue()).toBe('CAT-00123');
    expect(CategoryId.create('CAT-1234567').getValue()).toBe('CAT-1234567');
  });
  test.each(['', 'CAT-1', 'CAT-ABCDE', 'PROD-00123', 'CAT-00123 ', null, 5])(
    'rejects %j',
    (value) => {
      expect(() => CategoryId.create(value)).toThrow(/Invalid category id/i);
    },
  );
  test('compares by value', () => {
    expect(
      CategoryId.create('CAT-00001').equals(CategoryId.create('cat-00001')),
    ).toBe(true);
    expect(
      CategoryId.create('CAT-00001').equals(CategoryId.create('CAT-00002')),
    ).toBe(false);
  });
});

describe('ProductCategory aggregate', () => {
  const create = (name = 'Beverages') =>
    ProductCategory.create(
      CategoryName.create(name),
      CategoryId.create('CAT-00001'),
    );
  test('creates with identity, name and equal timestamps', () => {
    const category = create();
    expect(category.getId().getValue()).toBe('CAT-00001');
    expect(category.getName().getValue()).toBe('Beverages');
    expect(category.createdAt).toEqual(category.updatedAt);
  });
  test('requires value objects and valid timestamps', () => {
    expect(() => ProductCategory.create('Beverages', 'CAT-00001')).toThrow(
      /Invalid category state/i,
    );
    expect(() =>
      ProductCategory.restore({
        id: 'CAT-00001',
        name: 'Beverages',
        createdAt: 'yesterday',
        updatedAt: new Date(),
      }),
    ).toThrow(/Invalid category state/i);
  });
  test('restore re-validates persisted data', () => {
    expect(() =>
      ProductCategory.restore({
        id: 'bad',
        name: 'Beverages',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow(/Invalid category id/i);
  });
  test('updateName changes the name and refreshes updatedAt only when it differs', async () => {
    const category = create();
    const before = category.updatedAt.getTime();
    await new Promise((resolve) => setTimeout(resolve, 5));
    category.updateName(CategoryName.create('Beverages'));
    expect(category.updatedAt.getTime()).toBe(before);
    category.updateName(CategoryName.create('Drinks'));
    expect(category.getName().getValue()).toBe('Drinks');
    expect(category.updatedAt.getTime()).toBeGreaterThan(before);
    expect(category.getId().getValue()).toBe('CAT-00001');
  });
  test('updateName rejects raw strings', () => {
    expect(() => create().updateName('Drinks')).toThrow(
      /Invalid category name/i,
    );
  });
});
