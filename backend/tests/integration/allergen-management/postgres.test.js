import '../../../src/shared/config/index.js';
import request from 'supertest';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { createApp } from '../../../src/app.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createAllergenModule } from '../../../src/modules/allergen-management/index.js';
import { AllergenRepository } from '../../../src/modules/allergen-management/infrastructure/persistence/AllergenRepository.js';
import { AllergenService } from '../../../src/modules/allergen-management/application/services/AllergenService.js';
import { Allergen } from '../../../src/modules/allergen-management/domain/model/Allergen.js';
import { AllergenId } from '../../../src/modules/allergen-management/domain/model/AllergenId.js';
import { AllergenName } from '../../../src/modules/allergen-management/domain/model/AllergenName.js';
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
const name = (value) => AllergenName.create(value);
const id = (value) => AllergenId.create(value);

describeDB(
  'BCK04 PostgreSQL (isolated schema in dedicated _test database)',
  () => {
    let database, repository, service;
    beforeAll(async () => {
      database = await isolatedDatabase();
      await migrate(database);
      repository = new AllergenRepository(database);
      service = new AllergenService(repository);
    });
    afterAll(async () => {
      await database?.close();
    });
    beforeEach(async () => {
      await database.query('DROP TABLE IF EXISTS product_allergens');
      await database.query('DELETE FROM allergens');
    });

    test('migration creates the table and case-insensitive unique index', async () => {
      const { rows } = await database.query(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'allergens_name_key'`,
      );
      expect(rows[0].indexdef).toMatch(/UNIQUE.*lower/i);
      expect(await migrate(database)).toBe(0);
    });

    test('round-trips an allergen and updates it through the loaded aggregate', async () => {
      const created = await service.createAllergen({ id: 1, name: 'Gluten' });
      const loaded = await repository.findById(id(1));
      expect(loaded).toBeInstanceOf(Allergen);
      expect(loaded.getId().getValue()).toBe(1);
      expect(loaded.createdAt.toISOString()).toBe(created.createdAt);
      expect(
        (await repository.findByName(name('gLUTEN'))).getId().getValue(),
      ).toBe(1);
      expect(await repository.existsByName(name('GLUTEN'))).toBe(true);
      expect(await repository.existsByName(name('Nothing'))).toBe(false);
      const renamed = await service.updateAllergen(1, {
        name: 'Cereals containing gluten',
      });
      expect(renamed.name).toBe('Cereals containing gluten');
      expect(renamed.createdAt).toBe(created.createdAt);
    });

    test('unique index and primary key reject duplicates that bypass the application check (409)', async () => {
      await service.createAllergen({ id: 7, name: 'Milk' });
      await expect(
        repository.save(Allergen.create(name('MILK'), id(8))),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Allergen name already exists',
      });
      await expect(
        repository.save(Allergen.create(name('Lactose'), id(7))),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Allergen id already exists',
      });
    });

    test('concurrent registrations of the same name yield one success and one 409', async () => {
      const results = await Promise.allSettled([
        service.createAllergen({ id: 4, name: 'Fish' }),
        service.createAllergen({ id: 14, name: 'fish' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected').reason.status).toBe(
        409,
      );
    });

    test('search matches literally (LIKE wildcards are escaped) and filters by id', async () => {
      await service.createAllergen({ id: 5, name: 'Peanuts' });
      await service.createAllergen({ id: 8, name: 'Tree_Nuts' });
      await service.createAllergen({ id: 11, name: 'Sesame 100%' });
      expect(
        (await service.listAllergens({ name: '%' })).map((a) => a.name),
      ).toEqual(['Sesame 100%']);
      expect(
        (await service.listAllergens({ name: '_' })).map((a) => a.name),
      ).toEqual(['Tree_Nuts']);
      expect(
        (await service.listAllergens({ name: 'NUTS' })).map((a) => a.id),
      ).toEqual([5, 8]);
      expect(
        (await service.listAllergens({ id: '11' })).map((a) => a.name),
      ).toEqual(['Sesame 100%']);
    });

    test('schema CHECK constraints reject malformed rows', async () => {
      const insert = (value, text) =>
        database.query('INSERT INTO allergens (id, name) VALUES ($1, $2)', [
          value,
          text,
        ]);
      await expect(insert(15, 'X')).rejects.toMatchObject({ code: '23514' });
      await expect(insert(0, 'X')).rejects.toMatchObject({ code: '23514' });
      await expect(insert(2, ' padded ')).rejects.toMatchObject({
        code: '23514',
      });
      await expect(insert(3, '')).rejects.toMatchObject({ code: '23514' });
    });

    test('update/delete of a vanished row report 404 instead of resurrecting it', async () => {
      await service.createAllergen({ id: 9, name: 'Celery' });
      const stale = await repository.findById(id(9));
      await repository.delete(id(9));
      stale.updateName(name('Resurrected'));
      await expect(repository.save(stale)).rejects.toMatchObject({
        status: 404,
      });
      await expect(repository.delete(id(9))).rejects.toMatchObject({
        status: 404,
      });
      expect(await repository.existsByName(name('Resurrected'))).toBe(false);
    });

    test('referential integrity (AC6/BR3/BR5): app check and ON DELETE RESTRICT both yield 409', async () => {
      await service.createAllergen({ id: 1, name: 'Gluten' });
      // Before BCK05 migrates product_allergens, nothing can reference an allergen.
      expect(await repository.isReferenced(id(1))).toBe(false);
      // Stand-in for the BCK05 join table, declared exactly as the BCK04 design requires.
      await database.query(`CREATE TABLE product_allergens (
        product_id VARCHAR(32) NOT NULL,
        allergen_id SMALLINT NOT NULL REFERENCES allergens(id) ON DELETE RESTRICT,
        PRIMARY KEY (product_id, allergen_id)
      )`);
      expect(await repository.isReferenced(id(1))).toBe(false);
      await database.query(
        'INSERT INTO product_allergens (product_id, allergen_id) VALUES ($1, $2)',
        ['PROD-00001', 1],
      );
      expect(await repository.isReferenced(id(1))).toBe(true);
      await expect(service.deleteAllergen(1)).rejects.toMatchObject({
        status: 409,
        message: /referenced by existing business information/i,
      });
      // Race: the application check is bypassed, the database still protects the data.
      await expect(repository.delete(id(1))).rejects.toMatchObject({
        status: 409,
        message: /referenced by existing business information/i,
      });
      expect((await service.getAllergenById(1)).id).toBe(1);
      await database.query('DELETE FROM product_allergens');
      await service.deleteAllergen(1);
      await expect(service.getAllergenById(1)).rejects.toMatchObject({
        status: 404,
      });
    });

    test('full HTTP flow persisted in PostgreSQL', async () => {
      const users = new MemoryUserRepository();
      const userModule = createUserModule({ repository: users, security });
      const app = createApp({
        userModule,
        allergenModule: createAllergenModule({
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
        .post('/api/v1/allergens')
        .set(auth)
        .send({ id: 12, name: 'Sulphites' });
      expect(created.status).toBe(201);
      expect(
        (await request(app).get('/api/v1/allergens?name=sulph')).body[0].id,
      ).toBe(12);
      expect(
        (
          await request(app)
            .post('/api/v1/allergens')
            .set(auth)
            .send({ id: 13, name: 'SULPHITES' })
        ).status,
      ).toBe(409);
      expect(
        (await request(app).delete('/api/v1/allergens/12').set(auth)).status,
      ).toBe(204);
    });
  },
);