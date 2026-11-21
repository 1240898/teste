import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import '../../../src/shared/config/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { CustomerService } from '../../../src/modules/customer-management/application/services/CustomerService.js';
import { CustomerController } from '../../../src/modules/customer-management/api/controllers/customerController.js';
import { CustomerRoutes } from '../../../src/modules/customer-management/api/routes/customerRoutes.js';
import { Customer } from '../../../src/modules/customer-management/domain/model/Customer.js';
import {
  ContactInfo,
  CustomerId,
  CustomerName,
  DietaryRestriction,
  HealthDataConsent,
  LinkedUserId,
} from '../../../src/modules/customer-management/domain/model/values.js';
import { CustomerRepository } from '../../../src/modules/customer-management/infrastructure/persistence/CustomerRepository.js';
import { AllergenRepository } from '../../../src/modules/allergen-management/infrastructure/persistence/AllergenRepository.js';
import { AllergenService } from '../../../src/modules/allergen-management/application/services/AllergenService.js';
import { AllergenId } from '../../../src/modules/allergen-management/domain/model/AllergenId.js';

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

const customer = (id, restrictions, userId = null) =>
  Customer.create(
    CustomerId.create(id),
    CustomerName.create('Ana Silva'),
    ContactInfo.create(`${id.toLowerCase()}@example.com`, '+351912345678'),
    restrictions,
    userId,
    HealthDataConsent.grant(),
  );

describeDB(
  'BCK02/BCK04 PostgreSQL: dietary restrictions reference allergens',
  () => {
    let database, customers, allergens, allergenService;
    beforeAll(async () => {
      database = await isolatedDatabase();
      await migrate(database);
      customers = new CustomerRepository(database);
      allergens = new AllergenRepository(database);
      allergenService = new AllergenService(allergens);
    });
    afterAll(async () => {
      await database?.close();
    });
    beforeEach(async () => {
      await database.query(
        'DELETE FROM customer_dietary_restriction_allergens',
      );
      await database.query('DELETE FROM customers');
      await database.query('DELETE FROM allergens');
      await database.query(
        `INSERT INTO allergens (id, name) VALUES (1, 'Gluten'), (7, 'Milk')`,
      );
    });

    test('persists the allergen of a restriction and mirrors it in the link table', async () => {
      const saved = await customers.save(
        customer('CUST-0001', [
          DietaryRestriction.create('Lactose', 'Avoid dairy', 7),
          DietaryRestriction.create('Vegetarian'),
        ]),
      );
      expect(saved.dietaryRestrictions.map((x) => x.toJSON())).toEqual([
        { name: 'Lactose', description: 'Avoid dairy', allergenId: 7 },
        { name: 'Vegetarian', description: null, allergenId: null },
      ]);
      const { rows } = await database.query(
        'SELECT restriction, allergen_id FROM customer_dietary_restriction_allergens',
      );
      expect(rows).toEqual([{ restriction: 'Lactose', allergen_id: 7 }]);
      expect(await allergens.isReferenced(AllergenId.create(7))).toBe(true);
      expect(await allergens.isReferenced(AllergenId.create(1))).toBe(false);
    });

    test('an allergen used by a customer cannot be deleted (409), others can', async () => {
      await customers.save(
        customer('CUST-0001', [DietaryRestriction.create('Lactose', null, 7)]),
      );
      await expect(allergenService.deleteAllergen(7)).rejects.toMatchObject({
        status: 409,
      });
      // The foreign key is the final defence when the application check is bypassed.
      await expect(
        allergens.delete(AllergenId.create(7)),
      ).rejects.toMatchObject({ status: 409 });
      await expect(allergenService.deleteAllergen(1)).resolves.toBeUndefined();
    });

    test('updating the restrictions replaces the links, releasing the allergen', async () => {
      const saved = await customers.save(
        customer('CUST-0001', [DietaryRestriction.create('Lactose', null, 7)]),
      );
      saved.replaceDietaryRestrictions([{ name: 'Lactose' }]);
      await customers.save(saved);
      expect(await allergens.isReferenced(AllergenId.create(7))).toBe(false);
      await expect(allergenService.deleteAllergen(7)).resolves.toBeUndefined();
    });

    test('a concurrent contact update cannot restore withdrawn consent or allergen links', async () => {
      const userId = 'USR-00001';
      await database.query(
        `INSERT INTO users (id, name, email, roles, ever_activated, marketing_consent_timestamp)
         VALUES ($1, 'Ana Silva', 'cust-0001@example.com', ARRAY['CUSTOMER'], true, now())`,
        [userId],
      );
      await customers.save(
        customer(
          'CUST-0001',
          [DietaryRestriction.create('Milk', null, 7)],
          LinkedUserId.create(userId),
        ),
      );

      const service = new CustomerService(customers);
      const actor = { sub: userId };
      let markRead, resumeEdit;
      const read = new Promise((resolve) => {
        markRead = resolve;
      });
      const resume = new Promise((resolve) => {
        resumeEdit = resolve;
      });
      const find = customers.findByUserId.bind(customers);
      const spy = jest
        .spyOn(customers, 'findByUserId')
        .mockImplementationOnce(async (id) => {
          const snapshot = await find(id);
          markRead();
          await resume;
          return snapshot;
        });
      const contact = service.updateMine(actor, {
        name: 'Ana Costa',
        phoneNumber: '+351913456789',
      });
      try {
        await read;
        await service.updateMyAllergens(actor, { healthDataConsent: false });
      } finally {
        resumeEdit();
        spy.mockRestore();
      }

      expect(await contact).toMatchObject({
        name: 'Ana Costa',
        phoneNumber: '+351913456789',
        healthDataConsent: { given: false },
        dietaryRestrictions: [],
      });
      expect(await service.getMine(actor)).toMatchObject({
        name: 'Ana Costa',
        healthDataConsent: { given: false },
        dietaryRestrictions: [],
      });
      expect(await allergens.isReferenced(AllergenId.create(7))).toBe(false);
    });

    test('an unknown allergen is rejected (400) and nothing is written', async () => {
      await database.query('DELETE FROM allergens WHERE id = 1');
      await expect(
        customers.save(
          customer('CUST-0002', [DietaryRestriction.create('Celiac', null, 1)]),
        ),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Referenced allergen not found',
      });
      const { rows } = await database.query(
        `SELECT count(*)::int AS n FROM customers WHERE id = 'CUST-0002'`,
      );
      expect(rows[0].n).toBe(0);
    });
  },
);

describeDB('GDP01 consent migration', () => {
  test('removes legacy restrictions and links while keeping the customer record available', async () => {
    const database = await isolatedDatabase();
    try {
      await migrate(database, undefined, {
        throughVersion: '0029_aa05_security_audit_logs.sql',
      });
      await database.query(
        "INSERT INTO allergens (id, name) VALUES (7, 'Milk')",
      );
      await database.query(
        `INSERT INTO customers (id, name, email, phone_number, dietary_restrictions)
         VALUES ('CUST-0001', 'Ana Silva', 'ana@example.com', '+351912345678', $1::json)`,
        [JSON.stringify([{ name: 'Milk', allergenId: 7 }])],
      );
      await database.query(
        `INSERT INTO customer_dietary_restriction_allergens (customer_id, restriction, allergen_id)
         VALUES ('CUST-0001', 'Milk', 7)`,
      );

      const consentMigration = {
        throughVersion: '0030_customer_health_data_consent.sql',
      };
      expect(await migrate(database, undefined, consentMigration)).toBe(1);
      expect(await migrate(database, undefined, consentMigration)).toBe(0);
      const { rows } = await database.query(
        'SELECT dietary_restrictions, health_data_consent_given FROM customers WHERE id = $1',
        ['CUST-0001'],
      );
      expect(rows).toEqual([
        { dietary_restrictions: [], health_data_consent_given: false },
      ]);
      expect(
        (
          await database.query(
            'SELECT * FROM customer_dietary_restriction_allergens',
          )
        ).rows,
      ).toEqual([]);

      const app = express();
      const controller = new CustomerController(
        new CustomerService(new CustomerRepository(database)),
      );
      app.use(
        new CustomerRoutes(controller, {
          verifyToken(req, _res, next) {
            req.user = { roles: ['MANAGER'] };
            next();
          },
        }).setupRoutes(),
      );
      const response = await request(app)
        .get('/customers/CUST-0001')
        .expect(200);
      expect(response.body).toMatchObject({
        name: 'Ana Silva',
        email: 'ana@example.com',
        phoneNumber: '+351912345678',
        dietaryRestrictions: [],
        healthDataConsent: { given: false },
      });
    } finally {
      await database.close();
    }
  });
});
