import { validateForecast } from '../../../src/modules/forecast-planning/domain/forecast.js';

const options = [
  { productId: 'pizza', isPizza: true, sizes: [{ id: 'M' }] },
  { productId: 'drink', isPizza: false, sizes: [] },
];
const draft = {
  name: 'Weekend',
  startDate: '2026-11-21',
  endDate: '2026-11-22',
  entries: [
    { date: '2026-11-21', productId: 'pizza', sizeId: 'M', quantity: 2 },
    { date: '2026-11-22', productId: 'drink', quantity: 0 },
  ],
};
test('accepts sized pizza, unsized drink, zero and omitted demand', () => {
  expect(validateForecast(draft, options)).toEqual(draft);
  expect(validateForecast({ ...draft, entries: [] }, options).entries).toEqual(
    [],
  );
});
test.each([
  [{ quantity: -1 }, 'quantity'],
  [{ quantity: 1.5 }, 'quantity'],
  [{ sizeId: 'M' }, 'sizeId'],
  [{ date: '2026-11-23' }, 'date'],
  [{ date: '2026-02-30' }, 'date'],
  [{ productId: 'unknown' }, 'productId'],
])('rejects invalid entry %j at its field', (change, path) => {
  expect(() =>
    validateForecast(
      { ...draft, entries: [{ ...draft.entries[1], ...change }] },
      options,
    ),
  ).toThrow(expect.objectContaining({ field: expect.stringContaining(path) }));
});
test('rejects duplicate unsized entries and missing pizza size', () => {
  expect(() =>
    validateForecast(
      { ...draft, entries: [draft.entries[1], draft.entries[1]] },
      options,
    ),
  ).toThrow();
  expect(() =>
    validateForecast(
      { ...draft, entries: [{ ...draft.entries[0], sizeId: undefined }] },
      options,
    ),
  ).toThrow();
});
