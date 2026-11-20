import { jest } from '@jest/globals';
import { CatalogueNotFoundError } from '../../../src/modules/product-catalogue-and-information/application/CatalogueNotFoundError.js';
import { CatalogueService } from '../../../src/modules/product-catalogue-and-information/application/CatalogueService.js';
import { PricingMode } from '../../../src/modules/product-management/domain/model/PricingMode.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';
import { category, facts, product } from '../../helpers/catalogueFixtures.js';

// A valid fixed-price product and a sellable component-based product that has
// no predefined pizza yet (state between creating the product and its pizza).
const valid = () => product({ id: 'PROD-00001', name: 'Water' });
const withoutPizza = () =>
  product({
    id: 'PROD-00002',
    name: 'Pizza in preparation',
    pricingMode: PricingMode.COMPONENT_BASED,
    price: null,
  });

function service() {
  const roots = [valid(), withoutPizza()];
  const snapshot = facts({ roots, categories: [category()] });
  const logger = { warn: jest.fn() };
  const reader = {
    loadSellable: async () => snapshot,
    loadFor: async () => snapshot,
  };
  return { catalogue: new CatalogueService({ reader, logger }), logger };
}

describe('Catalogue with inconsistent product data', () => {
  test('the list still answers and omits only the inconsistent product', async () => {
    const { catalogue, logger } = service();
    const entries = await catalogue.list();
    expect(entries.map((entry) => entry.id)).toEqual(['PROD-00001']);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('PROD-00002'),
    );
  });

  test('the inconsistent product is not offered (404), not a server error', async () => {
    const { catalogue } = service();
    await expect(
      catalogue.getById(ProductId.create('PROD-00002')),
    ).rejects.toBeInstanceOf(CatalogueNotFoundError);
  });
});