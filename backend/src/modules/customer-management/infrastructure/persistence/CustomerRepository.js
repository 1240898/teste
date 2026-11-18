import { CustomerMapper } from './CustomerMapper.js';
import { AppError } from '../../../../shared/errors/AppError.js';
const ALLERGEN_FOREIGN_KEY =
  'customer_dietary_restriction_allergens_allergen_id_fkey';
export class CustomerRepository {
  constructor(database) {
    this.database = database;
  }
    async nextId() {
    const { rows } = await this.database.query(
      // GREATEST keeps every digit: lpad alone truncates values longer than the width.
      "SELECT 'CUST-' || lpad(n::text, GREATEST(4, length(n::text)), '0') AS id FROM (SELECT nextval('customer_id_seq') AS n) generated",
    );
    return rows[0].id;
  }
  async findById(id) {
    const { rows } = await this.database.query(
      'SELECT * FROM customers WHERE id = $1',
      [id.getValue()],
    );
    return rows[0] ? CustomerMapper.toDomain(rows[0]) : null;
  }
  async findByEmail(email) {
    const { rows } = await this.database.query(
      'SELECT * FROM customers WHERE email = $1',
      [email],
    );
    return rows[0] ? CustomerMapper.toDomain(rows[0]) : null;
  }
  async existsByEmail(email) {
    const { rows } = await this.database.query(
      'SELECT 1 FROM customers WHERE email = $1',
      [email],
    );
    return rows.length > 0;
  }
  async findByUserId(userId) {
    const { rows } = await this.database.query(
      'SELECT * FROM customers WHERE user_id = $1',
      [userId],
    );
    return rows[0] ? CustomerMapper.toDomain(rows[0]) : null;
  }
    async save(customer) {
    const p = CustomerMapper.toPersistence(customer);
    try {
      // The customer row and its allergen links are written atomically, so the links
      // always match the restrictions stored in dietary_restrictions.
      return await this.database.withTransaction(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO customers (id, name, email, phone_number, dietary_restrictions, user_id, active) VALUES ($1,$2,$3,$4,$5::json,$6,$7) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,phone_number=EXCLUDED.phone_number,dietary_restrictions=EXCLUDED.dietary_restrictions,user_id=EXCLUDED.user_id,active=EXCLUDED.active,updated_at=now() RETURNING *`,
          [
            p.id,
            p.name,
            p.email,
            p.phoneNumber,
            p.dietaryRestrictions,
            p.userId,
            p.active,
          ],
        );
        await client.query(
          'DELETE FROM customer_dietary_restriction_allergens WHERE customer_id = $1',
          [p.id],
        );
        if (p.restrictionAllergens.length)
          await client.query(
            `INSERT INTO customer_dietary_restriction_allergens (customer_id, restriction, allergen_id)
             SELECT $1, link.restriction, link.allergen_id
             FROM unnest($2::text[], $3::smallint[]) AS link(restriction, allergen_id)`,
            [
              p.id,
              p.restrictionAllergens.map((x) => x.restriction),
              p.restrictionAllergens.map((x) => x.allergenId),
            ],
          );
        return CustomerMapper.toDomain(rows[0]);
      });
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'customers_email_key')
        throw new AppError('Email already registered', 409);
      if (
        error.code === '23505' &&
        error.constraint === 'customers_user_id_key'
      )
        throw new AppError('User already linked to another customer', 409);
      if (
        error.code === '23503' &&
        error.constraint === 'customers_user_id_fkey'
      )
        throw new AppError('Referenced user not found', 400);
      if (
        error.code === '23503' &&
        error.constraint === ALLERGEN_FOREIGN_KEY
      )
        throw new AppError('Referenced allergen not found', 400);
      throw error;
    }
  }
  async search(criteria) {
    const clauses = [],
      values = [];
    for (const field of ['name', 'email', 'phoneNumber']) {
      const v = criteria[field];
      if (v?.trim()) {
        values.push(`%${v.trim().replace(/[\\%_]/g, '\\$&')}%`);
        clauses.push(
          `${field === 'phoneNumber' ? 'phone_number' : field} ILIKE $${values.length} ESCAPE E'\\\\'`,
        );
      }
    }
    if (criteria.userId?.trim()) {
      values.push(criteria.userId.trim());
      clauses.push(`user_id = $${values.length}`);
    }
    const { rows } = await this.database.query(
      `SELECT * FROM customers ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY name`,
      values,
    );
    return rows.map(CustomerMapper.toDomain);
  }
  async isReferencedByOtherEntities(_id) {
    // Extend this when later aggregates add Customer foreign keys.
    return false;
  }
}
