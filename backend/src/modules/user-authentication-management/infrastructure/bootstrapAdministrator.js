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
import { RoleChangeRecord } from '../domain/model/RoleChangeRecord.js';
import { RoleChangeRecordRepository } from './persistence/RoleChangeRecordRepository.js';

export async function bootstrapAdministrator(
  database,
  { name, email, password },
  hasher = new BcryptPasswordHasher(),
  repositoryFactory = (client) => new UserRepository(client),
) {
  name = UserName.create(name);
  email = Email.create(email);
  validatePassword(password);
  return database.withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(7420102)');
    const { rows } = await client.query(
      "SELECT EXISTS(SELECT 1 FROM users WHERE active AND 'ADMINISTRATOR' = ANY(roles)) AS exists",
    );
    if (rows[0].exists)
      throw new Error('An active Administrator already exists');
    const repository = repositoryFactory(client);
    const user = User.create(
      UserId.create(await repository.nextId()),
      name,
      email,
      Password.createFromHash(await hasher.hash(password)),
      MarketingConsent.create(false),
    );
    user.addRole(UserRole.ADMINISTRATOR);
    const saved = await repository.save(user);
    await new RoleChangeRecordRepository(client).save(
      new RoleChangeRecord({
        userId: saved.getId().getValue(),
        previousRoles: [],
        newRoles: saved.getRoles(),
        actor: {
          type: 'SYSTEM_PROCESS',
          systemProcess: 'INITIAL_ADMINISTRATOR_BOOTSTRAP',
        },
      }),
      client,
    );
    return UserResponseMapper.toDTO(saved);
  });
}
