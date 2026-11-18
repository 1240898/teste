import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { createPizzaSizeModule } from '../../../src/modules/pizza-size-management/index.js';
import { createUserModule } from '../../../src/modules/user-authentication-management/index.js';
import { createUser } from '../../helpers/createUser.js';
import { MemoryUserRepository } from '../../helpers/MemoryUserRepository.js';
import { AppError } from '../../../src/shared/errors/AppError.js';

const security = {
  secret: 'pizza-size-api-test-secret-with-more-than-32-bytes',
  expiresIn: '1d',
  issuer: 'laprizza',
  audience: 'laprizza-api',
};
const passwordHash = '$2b$10$' + 'a'.repeat(53);

class MemoryPizzaSizeRepository {
  sizes = new Map();
  referenced = new Set();
  sequence = 0;

  async nextId() {
    this.sequence += 1;
    return `PSIZE-${String(this.sequence).padStart(4, '0')}`;
  }
  async findById(id) {
    return this.sizes.get(id.getValue()) ?? null;
  }
  async findByName(name) {
    return (
      [...this.sizes.values()].find(
        (size) => size.name.getValue().toLowerCase() === name.toLowerCase(),
      ) ?? null
    );
  }
  async save(size) {
    const duplicate = await this.findByName(size.name.getValue());
    if (duplicate && duplicate.id.getValue() !== size.id.getValue())
      throw new AppError('Pizza size name already exists', 409);
    this.sizes.set(size.id.getValue(), size);
    return size;
  }
  async search(criteria) {
    return [...this.sizes.values()].filter((size) =>
      ['id', 'name'].every((field) => {
        const value = criteria[field];
        return (
          !value ||
          size[field].getValue().toLowerCase().includes(value.toLowerCase())
        );
      }) &&
      (criteria.active === undefined || size.isActive === criteria.active),
    );
  }
  async isReferencedByOtherEntities(id) {
    return this.referenced.has(id.getValue());
  }
  async delete(id) {
    if (!this.sizes.delete(id.getValue()))
      throw new AppError('Pizza size not found', 404);
  }
}

describe('BCK06 Pizza Size API', () => {
  let app;
  let repository;
  let managerToken;
  let employeeToken;

  beforeAll(async () => {
    const userRepository = new MemoryUserRepository();
    const userModule = createUserModule({
      repository: userRepository,
      security,
    });
    const manager = createUser({
      name: 'Manager',
      email: 'manager@example.com',
      passwordHash,
      roles: ['MANAGER'],
    });
    const employee = createUser({
      name: 'Employee',
      email: 'employee@example.com',
      passwordHash,
      roles: ['EMPLOYEE'],
    });
    await userRepository.save(manager);
    await userRepository.save(employee);
    managerToken = userModule.tokens.generateToken({
      sub: manager.getId().getValue(),
      email: manager.getEmail().getValue(),
      roles: manager.getRoles(),
    });
    employeeToken = userModule.tokens.generateToken({
      sub: employee.getId().getValue(),
      email: employee.getEmail().getValue(),
      roles: employee.getRoles(),
    });
    repository = new MemoryPizzaSizeRepository();
    const pizzaSizeModule = createPizzaSizeModule({
      repository,
      userService: userModule.userService,
    });
    app = createApp({ userModule, pizzaSizeModule });
  });

  test('allows public reads and requires MANAGER for writes', async () => {
    expect((await request(app).get('/api/v1/pizza-sizes')).status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/v1/pizza-sizes')
          .auth(employeeToken, { type: 'bearer' })
          .send({ name: 'Staff size' })
      ).status,
    ).toBe(403);
  });

  test('creates, gets, searches, updates, and deletes a size', async () => {
    const created = await request(app)
      .post('/api/v1/pizza-sizes')
      .auth(managerToken, { type: 'bearer' })
      .send({ name: 'Small' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: 'PSIZE-0001',
      name: 'Small',
      active: true,
    });

    expect(
      (
        await request(app)
          .get('/api/v1/pizza-sizes/PSIZE-0001')
      ).status,
    ).toBe(200);
    const searched = await request(app)
      .get('/api/v1/pizza-sizes')
      .query({ name: 'sMa' });
    expect(searched.status).toBe(200);
    expect(searched.body.map((size) => size.id)).toContain('PSIZE-0001');

    const updated = await request(app)
      .put('/api/v1/pizza-sizes/PSIZE-0001')
      .auth(managerToken, { type: 'bearer' })
      .send({ name: 'Personal', active: false });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Personal');
    expect(updated.body.active).toBe(false);

    const inactive = await request(app)
      .get('/api/v1/pizza-sizes')
      .query({ active: 'false' });
    expect(inactive.body.map((size) => size.id)).toContain('PSIZE-0001');
    expect(
      (
        await request(app)
          .get('/api/v1/pizza-sizes')
          .query({ active: 'true' })
      ).body.map((size) => size.id),
    ).not.toContain('PSIZE-0001');

    const reactivated = await request(app)
      .put('/api/v1/pizza-sizes/PSIZE-0001')
      .auth(managerToken, { type: 'bearer' })
      .send({ active: true });
    expect(reactivated.body.active).toBe(true);

    const deleted = await request(app)
      .delete('/api/v1/pizza-sizes/PSIZE-0001')
      .auth(managerToken, { type: 'bearer' });
    expect(deleted.status).toBe(204);
  });

  test('returns 400 for invalid input and 404 for missing IDs', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/pizza-sizes')
          .auth(managerToken, { type: 'bearer' })
          .send({ id: 'PSIZE-0001', name: 'Small' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get('/api/v1/pizza-sizes/PSIZE-9999')
      ).status,
    ).toBe(404);
  });

  test('returns 409 for a duplicate name and for deleting a referenced size', async () => {
    const first = await request(app)
      .post('/api/v1/pizza-sizes')
      .auth(managerToken, { type: 'bearer' })
      .send({ name: 'Medium' });
    const duplicate = await request(app)
      .post('/api/v1/pizza-sizes')
      .auth(managerToken, { type: 'bearer' })
      .send({ name: 'medium' });
    expect(duplicate.status).toBe(409);

    repository.referenced.add(first.body.id);
    const deletion = await request(app)
      .delete(`/api/v1/pizza-sizes/${first.body.id}`)
      .auth(managerToken, { type: 'bearer' });
    expect(deletion.status).toBe(409);
    expect(repository.sizes.has(first.body.id)).toBe(true);
  });
});
