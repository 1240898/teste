import { jest } from '@jest/globals';
import { PizzaSizeRepository } from '../../../src/modules/pizza-size-management/infrastructure/persistence/PizzaSizeRepository.js';
import { PizzaSizeId } from '../../../src/modules/pizza-size-management/domain/model/values.js';

const row = { id: 'PSIZE-0001', name: 'Small', active: true };

describe('PizzaSizeRepository transaction contract', () => {
  test('locks a Pizza Size when requested inside a transaction', async () => {
    const database = { query: jest.fn() };
    const tx = {
      query: jest.fn().mockResolvedValue({ rows: [row] }),
    };
    const repository = new PizzaSizeRepository(database);

    const result = await repository.findByIdForUpdate(
      PizzaSizeId.create('PSIZE-0001'),
      tx,
    );

    expect(result.getId().getValue()).toBe('PSIZE-0001');
    expect(tx.query).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      ['PSIZE-0001'],
    );
    expect(database.query).not.toHaveBeenCalled();
  });

  test('uses the transaction client when mapping a related Pizza Size', async () => {
    const database = { query: jest.fn() };
    const tx = {
      query: jest.fn().mockResolvedValue({ rows: [row] }),
    };
    const repository = new PizzaSizeRepository(database);

    await repository.findById(PizzaSizeId.create('PSIZE-0001'), tx);

    expect(tx.query).toHaveBeenCalledWith(
      'SELECT * FROM pizza_sizes WHERE id = $1',
      ['PSIZE-0001'],
    );
    expect(database.query).not.toHaveBeenCalled();
  });
});
