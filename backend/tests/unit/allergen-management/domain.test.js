import { AllergenId } from '../../../src/modules/allergen-management/domain/model/AllergenId.js';
import { AllergenName } from '../../../src/modules/allergen-management/domain/model/AllergenName.js';
import { Allergen } from '../../../src/modules/allergen-management/domain/model/Allergen.js';
import { EUAllergenType } from '../../../src/modules/allergen-management/domain/model/EUAllergenType.js';

describe('AllergenName (BCK04 BR1)', () => {
  test('UT01 accepts a valid name and normalises whitespace', () => {
    expect(AllergenName.create('  Tree   Nuts ').getValue()).toBe('Tree Nuts');
  });
  test.each(['', '   ', '\t\n'])('UT02 rejects blank name %j', (value) => {
    expect(() => AllergenName.create(value)).toThrow(
      /Allergen name cannot be empty/i,
    );
  });
  test.each([undefined, null, 42, {}, []])('rejects non-text %j', (value) => {
    expect(() => AllergenName.create(value)).toThrow(/must be text/i);
  });
  test('rejects names above 100 characters but accepts exactly 100', () => {
    expect(AllergenName.create('a'.repeat(100)).getValue()).toHaveLength(100);
    expect(() => AllergenName.create('a'.repeat(101))).toThrow(/exceed 100/i);
  });
  test('rejects control characters', () => {
    expect(() => AllergenName.create('Glu\u0000ten')).toThrow(
      /invalid characters/i,
    );
  });
  test('equality is case-insensitive', () => {
    expect(
      AllergenName.create('Gluten').equals(AllergenName.create('gLUTEN')),
    ).toBe(true);
    expect(
      AllergenName.create('Gluten').equals(AllergenName.create('Milk')),
    ).toBe(false);
  });
});

describe('AllergenId (EU Regulation No. 1169/2011)', () => {
  test.each([1, 7, 14, '1', '14'])('accepts %j', (value) => {
    expect(AllergenId.create(value).getValue()).toBe(Number(value));
  });
  test.each([0, 15, -1, 1.5, '0', '15', '1.0', ' 1', 'abc', '', null, NaN])(
    'rejects %j',
    (value) => {
      expect(() => AllergenId.create(value)).toThrow(/between 1 and 14/i);
    },
  );
  test('compares by value', () => {
    expect(AllergenId.create(3).equals(AllergenId.create('3'))).toBe(true);
    expect(AllergenId.create(3).equals(AllergenId.create(4))).toBe(false);
  });
  test('the EU list has exactly the 14 identifiers accepted', () => {
    expect(Object.keys(EUAllergenType).map(Number)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
  });
});

describe('Allergen aggregate', () => {
  const create = (name = 'Gluten') =>
    Allergen.create(AllergenName.create(name), AllergenId.create(1));
  test('creates with identity, name and equal timestamps', () => {
    const allergen = create();
    expect(allergen.getId().getValue()).toBe(1);
    expect(allergen.getName().getValue()).toBe('Gluten');
    expect(allergen.createdAt).toEqual(allergen.updatedAt);
  });
  test('requires value objects and valid timestamps', () => {
    expect(() => Allergen.create('Gluten', 1)).toThrow(
      /Invalid allergen state/i,
    );
    expect(() =>
      Allergen.restore({
        id: 1,
        name: 'Gluten',
        createdAt: 'yesterday',
        updatedAt: new Date(),
      }),
    ).toThrow(/Invalid allergen state/i);
  });
  test('restore re-validates persisted data', () => {
    expect(() =>
      Allergen.restore({
        id: 99,
        name: 'Gluten',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toThrow(/between 1 and 14/i);
  });
  test('updateName changes the name and refreshes updatedAt only when it differs', async () => {
    const allergen = create();
    const before = allergen.updatedAt.getTime();
    await new Promise((resolve) => setTimeout(resolve, 5));
    allergen.updateName(AllergenName.create('Gluten'));
    expect(allergen.updatedAt.getTime()).toBe(before);
    allergen.updateName(AllergenName.create('Cereals containing gluten'));
    expect(allergen.getName().getValue()).toBe('Cereals containing gluten');
    expect(allergen.updatedAt.getTime()).toBeGreaterThan(before);
    expect(allergen.getId().getValue()).toBe(1);
  });
  test('updateName rejects raw strings', () => {
    expect(() => create().updateName('Milk')).toThrow(/Invalid allergen name/i);
  });
});