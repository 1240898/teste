import '../../../src/shared/config/index.js';
import { isolatedDatabase } from '../../helpers/isolatedDatabase.js';
import { migrate } from '../../../src/shared/persistence/postgres/migrate.js';
import { Customer } from '../../../src/modules/customer-management/domain/model/Customer.js';
import {
  ContactInfo,
  CustomerId,
  CustomerName,
  DietaryRestriction,
} from '../../../src/modules/customer-management/domain/model/values.js';
import { CustomerRepository } from '../../../src/modules/customer-management/infrastructure/persistence/CustomerRepository.js';
import { AllergenRepository } from '../../../src/modules/allergen-management/infrastructure/persistence/AllergenRepository.js';
import { AllergenService } from '../../../src/modules/allergen-management/application/services/AllergenService.js';
import { AllergenId } from '../../../src/modules/allergen-management/domain/model/AllergenId.js';

const describeDB =
  process.env.RUN_DATABASE_TESTS === '1' ? describe : describe.skip;

const customer = (id, restrictions) =>
  Customer.create(
    CustomerId.create(id),
    CustomerName.create('Ana Silva'),
    ContactInfo.create(`${id.toLowerCase()}@example.com`, '+351912345678'),
    restrictions,
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
      await database.query('DELETE FROM customer_dietary_restriction_allergens');
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