
import { mergeDraft } from '../../../src/shared/feedback/mergeDraft.js';

const base = {
  name: 'Coca-Cola 33cl',
  description: 'Soft drink can',
  basePrice: 1.5,
  allergenIds: [],
};
const fieldNames = ['name', 'description', 'basePrice', 'allergenIds'];

describe('mergeDraft (412 review, clarification 15)', () => {
  test("keeps another manager's change to a field this draft did not touch", () => {
    const { merged, conflicts } = mergeDraft({
      base,
      draft: { ...base, name: 'Coke Zero' },
      current: { ...base, description: 'Changed by another manager' },
      fieldNames,
    });
    expect(conflicts).toEqual([]);
    expect(merged).toMatchObject({
      name: 'Coke Zero',
      description: 'Changed by another manager',
    });
  });

  test('reports a conflict when both managers changed the same field differently', () => {
    const { conflicts } = mergeDraft({
      base,
      draft: { ...base, name: 'Mine' },
      current: { ...base, name: 'Theirs' },
      fieldNames,
    });
    expect(conflicts).toEqual(['name']);
  });

  test('no conflict when both made the same change', () => {
    const { merged, conflicts } = mergeDraft({
      base,
      draft: { ...base, basePrice: 2 },
      current: { ...base, basePrice: 2 },
      fieldNames,
    });
    expect(conflicts).toEqual([]);
    expect(merged.basePrice).toBe(2);
  });

  test('a number typed back as text is not treated as a change', () => {
    const { merged, conflicts } = mergeDraft({
      base,
      draft: { ...base, basePrice: '1.5' },
      current: { ...base, basePrice: 3 },
      fieldNames,
    });
    expect(conflicts).toEqual([]);
    expect(merged.basePrice).toBe(3);
  });

  test('lists (allergens, composition) are compared as a whole', () => {
    const { merged, conflicts } = mergeDraft({
      base,
      draft: { ...base },
      current: { ...base, allergenIds: [7] },
      fieldNames,
    });
    expect(conflicts).toEqual([]);
    expect(merged.allergenIds).toEqual([7]);
  });
});
