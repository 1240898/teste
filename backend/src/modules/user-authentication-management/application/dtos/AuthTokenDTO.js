import { UserResponseDTO } from './UserResponseDTO.js';

export class AuthTokenDTO {
  constructor({
    accessToken,
    tokenType = 'Bearer',
    expiresIn,
    sessionCredential,
    csrfToken,
    idleTimeoutSeconds,
    activityReportIntervalSeconds,
    idleExpiresAt,
    hasLocalCredential,
    user,
  }) {
    this.accessToken = accessToken;
    this.tokenType = tokenType;
    this.expiresIn = expiresIn;
    this.sessionCredential = sessionCredential;
    this.csrfToken = csrfToken;
    this.idleTimeoutSeconds = idleTimeoutSeconds;
    this.activityReportIntervalSeconds = activityReportIntervalSeconds;
    this.idleExpiresAt = idleExpiresAt;
    this.hasLocalCredential = hasLocalCredential;
    this.user = new UserResponseDTO(user);
  }
}
