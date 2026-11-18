import { User } from '../domain/model/User.js';
import {
  Email,
  UserId,
  UserName,
  Password,
  MarketingConsent,
  UserRole,
} from '../domain/model/values.js';
import { validatePassword } from '../application/services/passwordPolicy.js';
import { UserResponseMapper } from '../application/mapping/UserResponseMapper.js';
import { UserRepository } from './persistence/UserRepository.js';
import { BcryptPasswordHasher } from './security/BcryptPasswordHasher.js';

export async function bootstrapManager(
  database,
  { name, email, password },
  hasher = new BcryptPasswordHasher(),
  repositoryFactory = (client) => new UserRepository(client),
) {
  name = UserName.create(name);
  email = Email.create(email);
  validatePassword(password);
  return database.withTransaction(async (client) => {
    // Serializes concurrent bootstrap commands; HTTP has no bootstrap route.
    await client.query('SELECT pg_advisory_xact_lock(7420101)');
    const { rows } = await client.query(
      "SELECT EXISTS(SELECT 1 FROM users WHERE active AND 'MANAGER' = ANY(roles)) AS exists",
    );
    if (rows[0].exists) throw new Error('An active Manager already exists');
    const repository = repositoryFactory(client);
    // AA03 (BR 1): created with [CUSTOMER] like every account, then promoted.
    const user = User.create(
      UserId.create(await repository.nextId()),
      name,
      email,
      Password.createFromHash(await hasher.hash(password)),
      MarketingConsent.create(false),
    );
    user.addRole(UserRole.MANAGER);
    return UserResponseMapper.toDTO(await repository.save(user));
  });
}
