import { jest } from '@jest/globals';
import { AllergenService } from '../../../src/modules/allergen-management/application/services/AllergenService.js';
import { MemoryAllergenRepository } from '../../helpers/MemoryAllergenRepository.js';

let repository, service;
beforeEach(() => {
  repository = new MemoryAllergenRepository();
  service = new AllergenService(repository);
});
const status = async (promise) =>
  promise.then(
    () => null,
    (e) => e.status,
  );

describe('AllergenService', () => {
  test('registers an allergen with its EU id and ISO timestamps', async () => {
    const created = await service.createAllergen({ id: 1, name: ' Gluten ' });
    expect(created).toEqual({
      id: 1,
      name: 'Gluten',
      createdAt: expect.stringMatching(/Z$/),
      updatedAt: expect.stringMatching(/Z$/),
    });
  });
  test('UT02 rejects blank names and invalid ids with 400 before touching the repository', async () => {
    const spy = jest.spyOn(repository, 'existsByName');
    await expect(service.createAllergen({ id: 1, name: '  ' })).rejects.toThrow(
      /Allergen name cannot be empty/i,
    );
    expect(await status(service.createAllergen({ id: 15, name: 'X' }))).toBe(
      400,
    );
    expect(spy).not.toHaveBeenCalled();
  });
  test('UT03 rejects duplicate names case-insensitively with 409', async () => {
    await service.createAllergen({ id: 1, name: 'Gluten' });
    const error = await service
      .createAllergen({ id: 2, name: 'GLUTEN' })
      .catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.message).toBe('Allergen name already exists');
  });
  test('rejects a duplicate id with 409', async () => {
    await service.createAllergen({ id: 7, name: 'Milk' });
    const error = await service
      .createAllergen({ id: 7, name: 'Lactose' })
      .catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.message).toBe('Allergen id already exists');
  });
  test('renames an allergen', async () => {
    await service.createAllergen({ id: 7, name: 'Milk' });
    const renamed = await service.updateAllergen('7', { name: 'Lactose' });
    expect(renamed).toMatchObject({ id: 7, name: 'Lactose' });
    expect((await service.getAllergenById(7)).name).toBe('Lactose');
  });
  test('allows changing only the capitalisation of its own name', async () => {
    await service.createAllergen({ id: 1, name: 'gluten' });
    expect((await service.updateAllergen(1, { name: 'Gluten' })).name).toBe(
      'Gluten',
    );
  });
  test('update conflicts with another name (409), missing id (404), bad id (400)', async () => {
    await service.createAllergen({ id: 1, name: 'Gluten' });
    await service.createAllergen({ id: 7, name: 'Milk' });
    expect(await status(service.updateAllergen(1, { name: 'milk' }))).toBe(409);
    expect(await status(service.updateAllergen(3, { name: 'Eggs' }))).toBe(404);
    expect(await status(service.updateAllergen('x', { name: 'X' }))).toBe(400);
    expect(await status(service.updateAllergen(1, { name: '' }))).toBe(400);
  });
  test('gets by id: 404 when missing, 400 when malformed or out of range', async () => {
    expect(await status(service.getAllergenById(4))).toBe(404);
    expect(await status(service.getAllergenById('abc'))).toBe(400);
    expect(await status(service.getAllergenById('99'))).toBe(400);
  });
  test('UT05 lists and searches by name (contains) or id (exact)', async () => {
    await service.createAllergen({ id: 8, name: 'Tree Nuts' });
    await service.createAllergen({ id: 1, name: 'Gluten' });
    await service.createAllergen({ id: 5, name: 'Peanuts' });
    expect((await service.listAllergens()).map((a) => a.id)).toEqual([1, 5, 8]);
    expect(
      (await service.listAllergens({ name: 'NUTS' })).map((a) => a.name),
    ).toEqual(['Peanuts', 'Tree Nuts']);
    expect(
      (await service.listAllergens({ id: '1' })).map((a) => a.name),
    ).toEqual(['Gluten']);
    expect(await service.listAllergens({ name: '   ' })).toHaveLength(3);
    expect(await service.listAllergens({ name: 'zzz' })).toEqual([]);
  });
  test('rejects malformed search filters with 400', async () => {
    expect(await status(service.listAllergens({ name: ['a', 'b'] }))).toBe(400);
    expect(await status(service.listAllergens({ name: 'x'.repeat(101) }))).toBe(
      400,
    );
    expect(await status(service.listAllergens({ id: 'abc' }))).toBe(400);
    expect(await status(service.listAllergens({ id: '20' }))).toBe(400);
  });
  test('UT04 refuses to delete an allergen referenced by business information (409)', async () => {
    await service.createAllergen({ id: 1, name: 'Gluten' });
    repository.referencedIds.add(1);
    const error = await service.deleteAllergen('1').catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/cannot be removed/i);
    expect((await service.getAllergenById(1)).id).toBe(1);
  });
  test('deletes an unreferenced allergen; 404 afterwards', async () => {
    await service.createAllergen({ id: 1, name: 'Gluten' });
    await service.deleteAllergen(1);
    expect(await status(service.getAllergenById(1))).toBe(404);
    expect(await status(service.deleteAllergen(1))).toBe(404);
  });
  test('never calls delete when the integrity check fails', async () => {
    await service.createAllergen({ id: 1, name: 'Gluten' });
    repository.referencedIds.add(1);
    const spy = jest.spyOn(repository, 'delete');
    await service.deleteAllergen(1).catch(() => {});
    expect(spy).not.toHaveBeenCalled();
  });
});