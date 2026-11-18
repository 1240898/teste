import { UserResponseDTO } from '../dtos/UserResponseDTO.js';

// Response mapping belongs to application, independently of SQL row mapping.
export class UserResponseMapper {
  static toDTO(user, { activationMethod = null } = {}) {
    return new UserResponseDTO({
      id: user.getId().getValue(),
      name: user.getName().getValue(),
      email: user.getEmail().getValue(),
      roles: user.getRoles(),
      active: user.isActive(),
      everActivated: user.wasEverActivated(),
      activationMethod,
      marketingConsent: user.getMarketingConsent().isGiven(),
      createdAt: user.createdAt.toISOString(),
    });
  }
  static toDTOList(users) {
    return users.map((user) => this.toDTO(user));
  }
}
