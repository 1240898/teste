import { jest } from '@jest/globals';
import { createPredefinedPizzaApi } from '../../src/features/business-management/predefined-pizzas/predefinedPizzaApi.js';

const notFound = () => Object.assign(new Error('not found'), { kind: 'http', status: 404 });
const serverError = () => Object.assign(new Error('down'), { kind: 'http', status: 503 });

// Fake HTTP client: the catalogue answers 404 for every pizza; the product
// endpoint answers with `product` (or throws `productError`).
function fakeRequest({ product, productError, catalogueError = notFound() }) {
  return jest.fn(async (method, path) => {
    if (path === '/predefined-pizzas') return [{ id: 'PROD-00010', componentIds: [] }];
    if (path === '/products') return [];
    if (path.startsWith('/catalogue/')) throw catalogueError;
    if (path === '/products/PROD-00010') {
      if (productError) throw productError;
      return product;
    }
    throw new Error(`Unexpected request ${method} ${path}`);
  });
}

async function offerStatusFor(options) {
  const api = createPredefinedPizzaApi(fakeRequest(options));
  const [pizza] = await api.list({}, undefined);
  return pizza.offerStatus;
}

describe('predefined pizza offer status after a catalogue 404', () => {
  test('an inactive pizza is reported as inactive', async () => {
    expect(
      await offerStatusFor({ product: { isActive: false, isSellable: true } }),
    ).toBe('inactive');
  });

  test('an active pizza missing from the catalogue is reported as not offered', async () => {
    expect(
      await offerStatusFor({ product: { isActive: true, isSellable: true } }),
    ).toBe('notOffered');
  });

  test('an active product that is not sellable is reported as such', async () => {
    expect(
      await offerStatusFor({ product: { isActive: true, isSellable: false } }),
    ).toBe('notSellable');
  });

  test('a product that no longer exists is reported as missing', async () => {
    expect(await offerStatusFor({ productError: notFound() })).toBe('missing');
  });

  test('a failure reading the product is a lookup error, not "unavailable"', async () => {
    expect(await offerStatusFor({ productError: serverError() })).toBe('error');
  });

  test('a catalogue failure other than 404 does not read the product', async () => {
    const request = fakeRequest({ catalogueError: serverError() });
    const [pizza] = await createPredefinedPizzaApi(request).list({}, undefined);
    expect(pizza.offerStatus).toBe('error');
    expect(request).not.toHaveBeenCalledWith('GET', '/products/PROD-00010', expect.anything());
  });
});
