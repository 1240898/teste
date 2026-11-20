import { CataloguePolicy } from '../../../src/modules/product-catalogue-and-information/domain/CataloguePolicy.js';
import { InvalidCatalogueData } from '../../../src/modules/product-catalogue-and-information/domain/InvalidCatalogueData.js';
import { PricingMode } from '../../../src/modules/product-management/domain/model/PricingMode.js';
import { ProductCompositionItem } from '../../../src/modules/product-management/domain/model/ProductCompositionItem.js';
import { ProductId } from '../../../src/modules/product-management/domain/model/ProductId.js';
import {
  allergen,
  category,
  facts,
  product,
} from '../../helpers/catalogueFixtures.js';

const GLUTEN = 1;
const MILK = 7;

const composedOf = (target, ...ids) => {
  target.replaceComposition(
    ids.map((id) => ProductCompositionItem.create(ProductId.create(id), 1)),
  );
  return target;
};

const allergenIdsOf = (entry) =>
  entry.allergens.map((item) => item.getId().getValue());

// Dough (gluten) and a sauce whose sub-component (cream) declares milk.
const dough = () =>
  product({ id: 'PROD-00002', name: 'Dough', sellable: false, component: true, allergenIds: [GLUTEN] });
const cream = () =>
  product({ id: 'PROD-00004', name: 'Cream', sellable: false, component: true, allergenIds: [MILK] });
const sauce = () =>
  composedOf(
    product({ id: 'PROD-00003', name: 'White sauce', sellable: false, component: true }),
    'PROD-00004',
  );
const pizza = (allergenIds = []) =>
  product({
    id: 'PROD-00001',
    name: 'Pizza',
    pricingMode: PricingMode.COMPONENT_BASED,
    price: null,
    allergenIds,
  });

const catalogueFacts = (root, others) =>
  facts({
    roots: [root],
    products: [root, ...others],
    categories: [category()],
    allergens: [allergen({ id: GLUTEN, name: 'Gluten' }), allergen({ id: MILK, name: 'Milk' })],
  });

describe('Catalogue allergens: direct and derived (WEB05 review)', () => {
  const policy = new CataloguePolicy();

  test('a pizza shows the allergen declared on the pizza product itself', () => {
    const root = composedOf(pizza([MILK]), 'PROD-00002');
    const entry = policy.evaluate(root, catalogueFacts(root, [dough()]));
    expect(allergenIdsOf(entry)).toEqual([GLUTEN, MILK]);
  });

  test('a pizza shows the allergens of components of its components', () => {
    const root = composedOf(pizza(), 'PROD-00002', 'PROD-00003');
    const entry = policy.evaluate(root, catalogueFacts(root, [dough(), sauce(), cream()]));
    expect(allergenIdsOf(entry)).toEqual([GLUTEN, MILK]);
  });

  test('a fixed-price product shows the allergens of its composition', () => {
    const root = composedOf(
      product({ id: 'PROD-00005', name: 'Lasagna', allergenIds: [GLUTEN] }),
      'PROD-00004',
    );
    const entry = policy.evaluate(root, catalogueFacts(root, [cream()]));
    expect(allergenIdsOf(entry)).toEqual([GLUTEN, MILK]);
  });

  test('each allergen appears once, even when declared at several levels', () => {
    const root = composedOf(pizza([MILK]), 'PROD-00003');
    const entry = policy.evaluate(root, catalogueFacts(root, [sauce(), cream()]));
    expect(allergenIdsOf(entry)).toEqual([MILK]);
  });

  test('a composition item missing from the facts is rejected', () => {
    const root = composedOf(pizza(), 'PROD-00003');
    expect(() => policy.evaluate(root, catalogueFacts(root, [sauce()]))).toThrow(
      InvalidCatalogueData,
    );
  });
});