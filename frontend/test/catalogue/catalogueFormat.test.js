import {
  formatPrice,
  lowestSizePrice,
} from '../../src/features/catalogue/catalogueFormat.js';

test('lowestSizePrice ignores unavailable sizes and selects the lowest available price', () => {
  const product = {
    pizza: {
      sizes: [
        { available: false, price: { amount: '4.00', currency: 'EUR' } },
        { available: true, price: { amount: '9.50', currency: 'EUR' } },
        { available: true, price: { amount: '7.25', currency: 'EUR' } },
      ],
    },
  };

  expect(lowestSizePrice(product)).toEqual({ amount: '7.25', currency: 'EUR' });
});

test.each([
  [{ pizza: { sizes: [] } }, null],
  [
    {
      pizza: {
        sizes: [
          { available: false, price: { amount: '5.00', currency: 'EUR' } },
        ],
      },
    },
    null,
  ],
  [{}, null],
])(
  'lowestSizePrice returns null when there is no available size',
  (product, expected) => {
    expect(lowestSizePrice(product)).toBe(expected);
  },
);

test('formatPrice formats the API amount and currency for the selected locale', () => {
  const result = formatPrice({ amount: '9.50', currency: 'EUR' }, 'pt-PT');
  expect(result).toContain('9,50');
  expect(result).toContain('€');
});

test('formatPrice safely falls back for unsupported currency data', () => {
  expect(formatPrice({ amount: '9.50', currency: 'EU' }, 'pt-PT')).toBe(
    '9.50 EU',
  );
});
