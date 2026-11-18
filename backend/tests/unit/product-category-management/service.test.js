import { jest } from '@jest/globals';
import { ProductCategoryService } from '../../../src/modules/product-category-management/application/services/ProductCategoryService.js';
import { MemoryProductCategoryRepository } from '../../helpers/MemoryProductCategoryRepository.js';

let repository, service;
beforeEach(() => {
  repository = new MemoryProductCategoryRepository();
  service = new ProductCategoryService(repository);
});
const status = async (promise) =>
  promise.then(
    () => null,
    (e) => e.status,
  );

describe('ProductCategoryService', () => {
  test('creates a category with a generated id and ISO timestamps', async () => {
    const created = await service.createCategory({ name: ' Beverages ' });
    expect(created).toEqual({
      id: 'CAT-00001',
      name: 'Beverages',
      createdAt: expect.stringMatching(/Z$/),
      updatedAt: expect.stringMatching(/Z$/),
    });
    expect((await service.createCategory({ name: 'Pizzas' })).id).toBe(
      'CAT-00002',
    );
  });
  test('UT02 rejects blank names with 400 before touching the repository', async () => {
    const spy = jest.spyOn(repository, 'existsByName');
    await expect(service.createCategory({ name: '  ' })).rejects.toThrow(
      /Category name cannot be empty/i,
    );
    expect(spy).not.toHaveBeenCalled();
  });
  test('UT03 rejects duplicate names case-insensitively with 409', async () => {
    await service.createCategory({ name: 'Pizzas' });
    const error = await service
      .createCategory({ name: 'PIZZAS' })
      .catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/already exists/i);
  });
  test('renames a category and refreshes updatedAt', async () => {
    const { id } = await service.createCategory({ name: 'Drinks' });
    const renamed = await service.updateCategory(id, { name: 'Beverages' });
    expect(renamed).toMatchObject({ id, name: 'Beverages' });
    expect((await service.getCategoryById(id)).name).toBe('Beverages');
  });
  test('allows changing only the capitalisation of its own name', async () => {
    const { id } = await service.createCategory({ name: 'beverages' });
    expect((await service.updateCategory(id, { name: 'Beverages' })).name).toBe(
      'Beverages',
    );
  });
  test('update conflicts with another category name (409), missing id (404), bad id (400)', async () => {
    const { id } = await service.createCategory({ name: 'Drinks' });
    await service.createCategory({ name: 'Pizzas' });
    expect(await status(service.updateCategory(id, { name: 'pizzas' }))).toBe(
      409,
    );
    expect(
      await status(service.updateCategory('CAT-99999', { name: 'X' })),
    ).toBe(404);
    expect(await status(service.updateCategory('nope', { name: 'X' }))).toBe(
      400,
    );
    expect(await status(service.updateCategory(id, { name: '' }))).toBe(400);
  });
  test('gets by id: 404 when missing, 400 when malformed', async () => {
    expect(await status(service.getCategoryById('CAT-00042'))).toBe(404);
    expect(await status(service.getCategoryById('42'))).toBe(400);
  });
  test('lists and searches by name or id (contains, case-insensitive)', async () => {
    for (const name of ['Pizzas', 'Soft Drinks', 'Hot Drinks'])
      await service.createCategory({ name });
    expect(await service.listCategories()).toHaveLength(3);
    expect(
      (await service.listCategories({ name: 'DRINKS' })).map((c) => c.name),
    ).toEqual(['Soft Drinks', 'Hot Drinks']);
    expect(await service.listCategories({ id: 'cat-00001' })).toHaveLength(1);
    expect(await service.listCategories({ name: '   ' })).toHaveLength(3);
    expect(await service.listCategories({ name: 'zzz' })).toEqual([]);
  });
  test('rejects malformed search filters with 400', async () => {
    expect(await status(service.listCategories({ name: ['a', 'b'] }))).toBe(
      400,
    );
    expect(await status(service.listCategories({ id: 'x'.repeat(101) }))).toBe(
      400,
    );
  });
  test('UT04 refuses to delete a category referenced by products (409)', async () => {
    const { id } = await service.createCategory({ name: 'Pizzas' });
    repository.referencedIds.add(id);
    const error = await service.deleteCategory(id).catch((e) => e);
    expect(error.status).toBe(409);
    expect(error.message).toMatch(
      /referenced by existing products cannot be removed/i,
    );
    expect((await service.getCategoryById(id)).id).toBe(id);
  });
  test('deletes an unreferenced category; 404 afterwards', async () => {
    const { id } = await service.createCategory({ name: 'Pizzas' });
    await service.deleteCategory(id);
    expect(await status(service.getCategoryById(id))).toBe(404);
    expect(await status(service.deleteCategory(id))).toBe(404);
  });
  test('never calls delete when the integrity check fails', async () => {
    const { id } = await service.createCategory({ name: 'Pizzas' });
    repository.referencedIds.add(id);
    const spy = jest.spyOn(repository, 'delete');
    await service.deleteCategory(id).catch(() => {});
    expect(spy).not.toHaveBeenCalled();
  });
});
