import { User } from '../../src/modules/user-authentication-management/domain/model/User.js';
import {
  UserId,
  Email,
  UserName,
  Password,
  MarketingConsent,
} from '../../src/modules/user-authentication-management/domain/model/values.js';
let nextFixtureId = 90000;
// AA03: User.create always assigns [CUSTOMER]; fixtures that need other roles
// replace them through the aggregate, like an Administrator would (AA06).
export function createUser({
  id = `USR-${String(++nextFixtureId).padStart(5, '0')}`,
  name,
  email,
  passwordHash,
  roles,
  marketingConsent = false,
}) {
  const user = User.create(
    UserId.create(id),
    UserName.create(name),
    Email.create(email),
    Password.createFromHash(passwordHash),
    MarketingConsent.create(marketingConsent),
  );
  if (roles !== undefined) user.setRoles(roles);
  return user;
}