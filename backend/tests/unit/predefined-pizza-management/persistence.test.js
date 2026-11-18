import { PostgresConfigurationReferenceReader } from '../../../src/modules/predefined-pizza-management/infrastructure/persistence/PostgresConfigurationReferenceReader.js';

const queryResult = (rows = []) => ({ rows });

describe('BCK10 configuration reference adapter', () => {
  test('reads Product, type and active size coverage facts without querying stock', async () => {
    const tx = { query: jest.fn() };
    tx.query
      .mockResolvedValueOnce(
        queryResult([
          { id: 'PROD-00123', is_sellable: true, is_pizza_component: false },
        ]),
      )
      .mockResolvedValueOnce(
        queryResult([
          {
            id: 'PROD-00124',
            is_active: true,
            is_pizza_component: true,
            pizza_component_type_id: 'type-01',
          },
        ]),
      )
      .mockResolvedValueOnce(
        queryResult([{ id: 'type-01', min_quantity: 1, max_quantity: 1 }]),
      )
      .mockResolvedValueOnce(queryResult([{ id: 'SIZE-00001' }]));
    const reader = new PostgresConfigurationReferenceReader({
      query: jest.fn(),
    });
    const facts = await reader.readFacts('PROD-00123', ['PROD-00124'], tx);
    expect(facts.representativeProduct.isSellable).toBe(true);
    expect(facts.components).toHaveLength(1);
    expect(facts.typeRules[0].maxQuantity).toBe(1);
    expect(facts.activeStructurallyEligibleSizes).toEqual(['SIZE-00001']);
    expect(tx.query).toHaveBeenCalledTimes(4);
    expect(tx.query.mock.calls[3][0]).toMatch(/WHERE size\.active = TRUE/);
    expect(
      tx.query.mock.calls.every(([sql]) => !/stock|availability/i.test(sql)),
    ).toBe(true);
  });
});
import { jest } from '@jest/globals';
