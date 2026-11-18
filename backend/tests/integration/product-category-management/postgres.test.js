import '../../../src/shared/config/index.js';
import request from 'supertest';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createProductCategoryModule } from '../../../src/modules/product-category-management/index.js';
import { ProductCategoryRepository } from '../../../src/modules/product-category-management/infrastructure/persistence/ProductCategoryRepository.js';
import { ProductCategoryService } from '../../../src/modules/product-category-management/application/services/ProductCategoryService.js';
import { ProductCategory } from '../../../src/modules/product-category-management/domain/model/ProductCategory.js';
import { CategoryId } from '../../../src/modules/product-category-management/domain/model/CategoryId.js';
import { CategoryName } from '../../../src/modules/product-category-management/domain/model/CategoryName.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { createUser } from '../../helpers/createUser.js';

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;
const security = {
  secret: 'postgres-test-secret-at-least-thirty-two-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const name = (value) => CategoryName.create(value);

describeDB(
  'BCK03 PostgreSQL (isolated schema in dedicated _test database)',
  () => {
    let database, repository, service;
    beforeAll(async () => {
      database = await isolatedDatabase();
      await migrate(database);
      repository = new ProductCategoryRepository(database);
      service = new ProductCategoryService(repository);
    });
    afterAll(async () => {
      await database?.close();
    });

    test('migration creates the table, sequence and case-insensitive unique index', async () => {
      const { rows } = await database.query(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'product_categories_name_key'`,
      );
      expect(rows[0].indexdef).toMatch(/UNIQUE.*lower/i);
      expect(await migrate(database)).toBe(0);
    });

    test('allocates sequential CAT-NNNNN identifiers', async () => {
      const first = await repository.nextId();
      const second = await repository.nextId();
      expect(first.getValue()).toMatch(/^CAT-\d{5,}$/);
      expect(Number(second.getValue().slice(4))).toBe(
        Number(first.getValue().slice(4)) + 1,
      );
    });

    test('round-trips a category and updates it through the loaded aggregate', async () => {
      const created = await service.createCategory({ name: 'Beverages' });
      const loaded = await repository.findById(CategoryId.create(created.id));
      expect(loaded).toBeInstanceOf(ProductCategory);
      expect(loaded.getName().getValue()).toBe('Beverages');
      expect(loaded.createdAt.toISOString()).toBe(created.createdAt);
      expect(
        (await repository.findByName(name('bEVERAGES'))).getId().getValue(),
      ).toBe(created.id);
      expect(await repository.existsByName(name('BEVERAGES'))).toBe(true);
      expect(await repository.existsByName(name('Nothing'))).toBe(false);
      const renamed = await service.updateCategory(created.id, {
        name: 'Drinks',
      });
      expect(renamed.name).toBe('Drinks');
      expect(new Date(renamed.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updatedAt).getTime(),
      );
      expect(renamed.createdAt).toBe(created.createdAt);
    });

    test('unique index rejects duplicates that bypass the application check (409)', async () => {
      await service.createCategory({ name: 'Desserts' });
      const rival = ProductCategory.create(
        name('DESSERTS'),
        await repository.nextId(),
      );
      await expect(repository.save(rival)).rejects.toMatchObject({
        status: 409,
        message: 'Category name already exists',
      });
    });

    test('concurrent creations of the same name yield one 201 and one 409', async () => {
      const results = await Promise.allSettled([
        service.createCategory({ name: 'Salads' }),
        service.createCategory({ name: 'salads' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected').reason.status).toBe(
        409,
      );
    });

    test('search matches literally (LIKE wildcards are escaped) and case-insensitively', async () => {
      await service.createCategory({ name: '100% Italian' });
      await service.createCategory({ name: 'a_b' });
      await service.createCategory({ name: 'axb' });
      expect(
        (await service.listCategories({ name: '%' })).map((c) => c.name),
      ).toEqual(['100% Italian']);
      expect(
        (await service.listCategories({ name: 'A_B' })).map((c) => c.name),
      ).toEqual(['a_b']);
      expect((await service.listCategories({ name: 'ITALIAN' })).length).toBe(
        1,
      );
      expect((await service.listCategories({ id: 'cat-' })).length).toBe(
        (await service.listCategories()).length,
      );
    });

    test('schema CHECK constraints reject malformed rows', async () => {
      const insert = (id, value) =>
        database.query(
          'INSERT INTO product_categories (id, name) VALUES ($1, $2)',
          [id, value],
        );
      await expect(insert('BAD-1', 'X')).rejects.toMatchObject({
        code: '23514',
      });
      await expect(insert('CAT-90001', ' padded ')).rejects.toMatchObject({
        code: '23514',
      });
      await expect(insert('CAT-90002', '')).rejects.toMatchObject({
        code: '23514',
      });
    });

    test('update/delete of a vanished row report 404 instead of resurrecting it', async () => {
      const created = await service.createCategory({ name: 'Temporary' });
      const stale = await repository.findById(CategoryId.create(created.id));
      await repository.delete(CategoryId.create(created.id));
      stale.updateName(name('Resurrected'));
      await expect(repository.save(stale)).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        repository.delete(CategoryId.create(created.id)),
      ).rejects.toMatchObject({ status: 404 });
      expect(await repository.existsByName(name('Resurrected'))).toBe(false);
    });

    test('referential integrity (AC5/BR3/BR5): app check and ON DELETE RESTRICT both yield 409', async () => {
  const { id } = await service.createCategory({ name: 'Pizzas' });
  const categoryId = CategoryId.create(id);

  // Initially, no products reference this category.
  expect(await repository.isReferencedByProducts(categoryId)).toBe(false);

  // BCK05 requires a complete, valid product row.
  await database.query(
    `INSERT INTO products (
       id, name, description, category_id, is_sellable,
       acquisition_type, pricing_mode, base_price_amount, base_price_currency
     )
     VALUES ($1, 'Test', 'Test', $2, true, 'PURCHASED', 'FIXED', 1, 'EUR')`,
    ['PROD-00001', id],
  );

  // The category is now referenced by a product.
  expect(await repository.isReferencedByProducts(categoryId)).toBe(true);

  // Application-level referential integrity.
  await expect(service.deleteCategory(id)).rejects.toMatchObject({
    status: 409,
    message: /referenced by existing products/i,
  });

  // Database-level referential integrity (ON DELETE RESTRICT).
  await expect(repository.delete(categoryId)).rejects.toMatchObject({
    status: 409,
    message: /referenced by existing products/i,
  });

  // The category must still exist.
  expect((await service.getCategoryById(id)).id).toBe(id);

  // Remove the referencing product.
  await database.query(
    'DELETE FROM products WHERE id = $1',
    ['PROD-00001'],
  );

  // The category can now be deleted.
  await service.deleteCategory(id);

  await expect(service.getCategoryById(id)).rejects.toMatchObject({
    status: 404,
  });
});

    test('full HTTP flow persisted in PostgreSQL', async () => {
      const users = new MemoryUserRepository();
      const userModule = createUserModule({ repository: users, security });
      const app = createApp({
        userModule,
        categoryModule: createProductCategoryModule({
          repository,
          userService: userModule.userService,
        }),
      });
      const manager = createUser({
        name: 'Manager',
        email: 'm@example.com',
        passwordHash: await userModule.hasher.hash('long-password'),
        roles: ['MANAGER'],
      });
      await users.save(manager);
      const token = userModule.tokens.generateToken({
        sub: manager.getId().getValue(),
        email: 'm@example.com',
        roles: ['MANAGER'],
      });
      const auth = { Authorization: `Bearer ${token}` };
      const created = await request(app)
        .post('/api/v1/categories')
        .set(auth)
        .send({ name: 'HTTP Pizzas' });
      expect(created.status).toBe(201);
      expect(
        (await request(app).get(`/api/v1/categories?name=http`)).body[0].id,
      ).toBe(created.body.id);
      expect(
        (
          await request(app)
            .post('/api/v1/categories')
            .set(auth)
            .send({ name: 'http pizzas' })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .delete(`/api/v1/categories/${created.body.id}`)
            .set(auth)
        ).status,
      ).toBe(204);
    });
  },
);
