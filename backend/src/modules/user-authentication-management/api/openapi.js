const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});
const roles = {
  type: 'array',
  minItems: 0,
  maxItems: 4,
  uniqueItems: true,
  items: {
    type: 'string',
    enum: ['ADMINISTRATOR', 'MANAGER', 'EMPLOYEE', 'CUSTOMER'],
  },
};
const assignableRoles = {
  type: 'array',
  minItems: 0,
  items: {
    type: 'string',
    enum: ['ADMINISTRATOR', 'MANAGER', 'EMPLOYEE', 'CUSTOMER'],
  },
};
const email = { type: 'string', format: 'email', maxLength: 254 };
const password = {
  type: 'string',
  minLength: 12,
  maxLength: 72,
  writeOnly: true,
  description:
    'At least 12 characters with uppercase, lowercase, digit and special character; at most 72 UTF-8 bytes. Passwords are never trimmed.',
};
const activationToken = {
  type: 'string',
  minLength: 43,
  maxLength: 43,
  pattern: '^[A-Za-z0-9_-]{43}$',
  writeOnly: true,
  description: 'Single-use token from the activation email.',
};
const userFields = {
  id: {
    type: 'string',
    pattern: '^USR-[0-9]{5,}$',
    example: 'USR-00001',
  },
  name: { type: 'string', minLength: 1, maxLength: 100 },
  email,
  roles,
  active: { type: 'boolean' },
  everActivated: { type: 'boolean' },
  activationMethod: {
    type: 'string',
    enum: ['LOCAL', 'EXTERNAL'],
    nullable: true,
    description:
      'Latest invitation method for administrator views; null when no method is known.',
  },
  marketingConsent: { type: 'boolean' },
  createdAt: { type: 'string', format: 'date-time' },
};
const registrationUserFields = {
  ...userFields,
  invitationDelivery: {
    type: 'object',
    properties: {
      deliveryStatus: {
        type: 'string',
        enum: ['SENT', 'FAILED', 'NOT_CONFIGURED'],
      },
      expiresAt: { type: 'string', format: 'date-time' },
      retryable: { type: 'boolean' },
    },
  },
};
export const userSchemas = {
  RegisterUserRequest: object(
    {
      name: userFields.name,
      email,
      password,
      marketingConsent: { type: 'boolean', default: false },
    },
    ['name', 'email', 'password'],
  ),
  LoginRequest: object({
    email,
    password: {
      type: 'string',
      minLength: 1,
      maxLength: 72,
      writeOnly: true,
      description:
        'Existing credential value; at most 72 UTF-8 bytes and no null character. The creation policy is not applied during login.',
    },
  }),
  PasswordRecoveryRequest: object({ email }),
  PasswordRecoveryCompleteRequest: object({
    linkToken: {
      type: 'string',
      minLength: 1,
      maxLength: 256,
      writeOnly: true,
    },
    newPassword: password,
  }),
  PasswordChangeRequest: object({
    currentPassword: {
      type: 'string',
      minLength: 1,
      maxLength: 72,
      writeOnly: true,
      description:
        'Current credential; at most 72 UTF-8 bytes and no null character. Never logged or returned.',
    },
    newPassword: {
      ...password,
      description: `${password.description} For an authenticated change, it must also differ from the current password by at least four edits.`,
    },
  }),
  PasswordRecoveryAccepted: object({
    message: {
      type: 'string',
      example:
        'If the account is eligible, recovery instructions will be sent.',
    },
  }),
  UpdateRolesRequest: object({
    roles: {
      ...assignableRoles,
      description: 'Supported roles; duplicate values are normalized to a set.',
    },
  }),
  UserResponse: object(userFields),
  RegistrationResponse: object(registrationUserFields),
  ActivationMethod: {
    type: 'string',
    enum: ['LOCAL', 'EXTERNAL'],
    description:
      'LOCAL uses the account password flow; EXTERNAL uses verified Google identity.',
  },
  InviteWorkerRequest: object({
    name: userFields.name,
    email,
    role: {
      type: 'string',
      enum: ['ADMINISTRATOR', 'MANAGER', 'EMPLOYEE', 'CUSTOMER'],
    },
    activationMethod: ref('ActivationMethod'),
  }),
  InviteWorkerResult: object({
    user: ref('UserResponse'),
    invitationDelivery: object({
      deliveryStatus: {
        type: 'string',
        enum: ['SENT', 'FAILED', 'NOT_REQUIRED'],
      },
      expiresAt: { type: 'string', format: 'date-time', nullable: true },
      retryable: { type: 'boolean' },
    }),
  }),
  InvitationReplacementRequest: object(
    { activationMethod: ref('ActivationMethod') },
    [],
  ),
  InvitationResult: object({
    deliveryStatus: { type: 'string', enum: ['SENT', 'FAILED'] },
    expiresAt: { type: 'string', format: 'date-time' },
    retryable: { type: 'boolean' },
    activationMethod: ref('ActivationMethod'),
  }),
  ActivateAccountRequest: object({ active: { type: 'boolean', enum: [true] } }),
  ActivationInvitationRequest: object({ token: activationToken }),
  LocalActivationRequest: object(
    {
      token: activationToken,
      password: {
        ...password,
        description: `${password.description} Supply it only to set the account's first password.`,
      },
    },
    ['token'],
  ),
  ActivationInspectionResponse: object({ method: ref('ActivationMethod') }),
  LocalActivationResponse: object({
    nextSignIn: { type: 'string', enum: ['LOCAL'] },
  }),
  ExternalActivationSignedInResponse: object({
    status: { type: 'string', enum: ['SIGNED_IN'] },
    auth: ref('AuthenticationResponse'),
  }),
  ExternalActivationOnlyResponse: object({
    status: { type: 'string', enum: ['ACTIVATED'] },
    nextSignIn: { type: 'string', enum: ['EXTERNAL'] },
  }),
  AuthenticationResponse: object(
    {
      accessToken: { type: 'string' },
      tokenType: { type: 'string', enum: ['Bearer'] },
      expiresIn: {
        type: 'string',
        example: '5m',
        description: 'Configured duration, maximum one day.',
      },
      csrfToken: {
        type: 'string',
        description:
          'Session-bound CSRF value; send in X-CSRF-Token on renewal and logout. The opaque renewal credential is set in an HttpOnly cookie.',
      },
      idleTimeoutSeconds: {
        type: 'integer',
        description: 'Provided by the AA04 session integration.',
      },
      activityReportIntervalSeconds: {
        type: 'integer',
        description: 'Provided by the AA04 session integration.',
      },
      idleExpiresAt: {
        type: 'string',
        format: 'date-time',
        description: 'Provided by the AA04 session integration.',
      },
      hasLocalCredential: {
        type: 'boolean',
        description: 'Whether the account has a local password to change.',
      },
      user: ref('UserResponse'),
    },
    [
      'accessToken',
      'tokenType',
      'expiresIn',
      'csrfToken',
      'idleTimeoutSeconds',
      'activityReportIntervalSeconds',
      'idleExpiresAt',
      'hasLocalCredential',
      'user',
    ],
  ),
  ErrorResponse: object({
    error: object({ message: { type: 'string' }, status: { type: 'integer' } }),
  }),
  // AA02: Google sign-in (OIDC Authorization Code flow + PKCE).
  GoogleAuthorizationResponse: object({
    authorizationUrl: {
      type: 'string',
      format: 'uri',
      description:
        'Google authorization URL the browser is redirected to (contains state, nonce and the S256 code challenge).',
    },
    state: {
      type: 'string',
      description:
        'One-time value (10 minutes) to compare with the state returned by Google.',
    },
  }),
  GoogleCallbackRequest: object({
    code: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      writeOnly: true,
      description: 'Authorization code returned by Google (single use).',
    },
    state: {
      type: 'string',
      minLength: 16,
      maxLength: 256,
      pattern: '^[A-Za-z0-9_-]+$',
      description: 'State returned by Google with the code.',
    },
  }),
};
const descriptions = {
  400: 'Invalid request',
  401: 'Missing/invalid token, invalid credentials, or incorrect current password',
  403: 'Access denied',
  404: 'User not found',
  409: 'Email already registered or account/password changed concurrently',
  413: 'Request body too large',
  429: 'Too many attempts',
  422: 'Recovery token, local credential or new password cannot be accepted',
  503: 'Invitation delivery is not configured',
  500: 'Internal server error; implementation details are withheld',
};
function operation(
  operationId,
  summary,
  {
    input,
    inputRequired = true,
    status = 200,
    output,
    errors = [],
    publicRoute = false,
    id = false,
    parameters = [],
    successDescription,
    successHeaders,
    errorDescriptions = {},
    cookieRoute = false,
    csrfHeader = true,
  } = {},
) {
  const headers =
    successHeaders ??
    (status === 201
      ? {
          Location: {
            description: 'Created user resource',
            schema: { type: 'string' },
          },
        }
      : undefined);
  return {
    operationId,
    summary,
    tags: ['Users and authentication'],
    security: publicRoute
      ? []
      : cookieRoute
        ? [{ sessionCookie: [] }]
        : [{ bearerAuth: [] }, { accessToken: [] }],
    ...(cookieRoute && csrfHeader
      ? {
          parameters: [
            {
              name: 'X-CSRF-Token',
              in: 'header',
              required: true,
              schema: { type: 'string' },
            },
          ],
        }
      : {}),
    ...(input
      ? { requestBody: { required: inputRequired, content: json(ref(input)) } }
      : {}),
    ...(id
      ? {
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                pattern: '^USR-[0-9]{5,}$',
                example: 'USR-00001',
              },
            },
          ],
        }
      : {}),
    ...(parameters.length > 0
      ? { parameters: [...(id ? [] : []), ...parameters] }
      : {}),
    responses: {
      [status]: {
        description:
          successDescription ||
          (status === 201
            ? 'Account created'
            : status === 204
              ? 'Account deactivated (idempotent)'
              : 'Success'),
        ...(output ? { content: json(output) } : {}),
        ...(headers ? { headers } : {}),
      },
      ...Object.fromEntries(
        [...errors, 500].map((code) => [
          code,
          {
            description: errorDescriptions[code] ?? descriptions[code],
            content: json(ref('ErrorResponse')),
          },
        ]),
      ),
    },
  };
}
export const userPaths = {
  '/users/register': {
    post: operation(
      'registerUser',
      'Public registration; creates an inactive CUSTOMER',
      {
        publicRoute: true,
        input: 'RegisterUserRequest',
        status: 201,
        output: ref('RegistrationResponse'),
        errors: [400, 409, 413, 429],
      },
    ),
  },
  '/users/invitations': {
    post: operation(
      'inviteWorker',
      'Create or reuse an account and issue its activation invitation',
      {
        input: 'InviteWorkerRequest',
        status: 201,
        output: ref('InviteWorkerResult'),
        errors: [400, 401, 403, 404, 409, 503],
        errorDescriptions: {
          403: 'Administrator role required',
          409: 'A previously activated account must be reactivated; a replacement must preserve its activation method',
        },
      },
    ),
  },
  '/users/activation/inspect': {
    post: operation(
      'inspectActivationInvitation',
      'Read the invitation method',
      {
        publicRoute: true,
        input: 'ActivationInvitationRequest',
        output: ref('ActivationInspectionResponse'),
        successDescription: 'The invitation is still pending',
        errors: [400, 413, 429],
        errorDescriptions: { 400: 'Invalid request or unavailable invitation' },
      },
    ),
  },
  '/users/activation/local': {
    post: operation(
      'activateLocalAccount',
      'Activate an invited local account',
      {
        publicRoute: true,
        input: 'LocalActivationRequest',
        output: ref('LocalActivationResponse'),
        successDescription:
          'Account activated. Local sign-in is a separate request',
        errors: [400, 409, 413, 429],
        errorDescriptions: {
          400: 'Invalid request or password, unavailable invitation, or a first password is required',
          409: 'A password was supplied for an account that already has one',
        },
      },
    ),
  },
  '/users/activation/external/start': {
    post: operation(
      'startExternalActivation',
      'Start Google verification for an invitation',
      {
        publicRoute: true,
        input: 'ActivationInvitationRequest',
        output: ref('GoogleAuthorizationResponse'),
        errors: [400, 401, 413, 429],
        errorDescriptions: {
          400: 'Invalid request or unavailable external invitation',
          401: 'Google authentication is not configured',
        },
      },
    ),
  },
  '/users/activation/external/complete': {
    post: operation(
      'completeExternalActivation',
      'Verify the Google recipient and activate the account',
      {
        publicRoute: true,
        input: 'GoogleCallbackRequest',
        output: {
          oneOf: [
            ref('ExternalActivationSignedInResponse'),
            ref('ExternalActivationOnlyResponse'),
          ],
        },
        successDescription:
          'Account activated. SIGNED_IN includes a session. ACTIVATED confirms activation without a session',
        successHeaders: {
          'Set-Cookie': {
            description:
              'AA04 HttpOnly session cookie. Present only with SIGNED_IN.',
            schema: { type: 'string' },
          },
        },
        errors: [400, 401, 409, 413, 429],
        errorDescriptions: {
          400: 'Invalid callback request or unavailable invitation',
          401: 'Google verification failed, the OAuth state is invalid, or the verified email does not match the recipient',
          409: 'The verified external identity conflicts with an existing association',
        },
      },
    ),
  },
  '/auth/login': {
    post: operation('login', 'Authenticate an active account', {
      publicRoute: true,
      input: 'LoginRequest',
      output: ref('AuthenticationResponse'),
      errors: [400, 401, 403, 413, 429],
      // AA03: after a correct password, inactive accounts and accounts
      // without roles receive an access-denied message.
      errorDescriptions: {
        403: 'Correct credentials, but the account is not active or has no active role',
      },
    }),
  },
  '/auth/renew': {
    post: operation(
      'renewSession',
      'Renew the current application session after qualifying user activity',
      {
        cookieRoute: true,
        output: ref('AuthenticationResponse'),
        errors: [401, 403],
        errorDescriptions: {
          401: 'Session is missing, expired, revoked, or CSRF validation failed',
          403: 'Account is inactive or has no active role',
        },
      },
    ),
  },
  '/auth/resume': {
    post: operation(
      'resumeSession',
      'Restore an unexpired application session after a page reload without extending its inactivity deadline',
      {
        cookieRoute: true,
        csrfHeader: false,
        output: ref('AuthenticationResponse'),
        errors: [401, 403],
        errorDescriptions: {
          401: 'Session is missing, expired, or revoked',
          403: 'Account is inactive, has no active role, or request origin is not allowed',
        },
      },
    ),
  },
  '/auth/logout': {
    post: operation(
      'logoutSession',
      'Revoke only the current application session',
      {
        cookieRoute: true,
        status: 204,
        successDescription: 'Current application session revoked',
        errors: [401],
      },
    ),
  },
  // AA03: current user and internal roles, always read from the database.
  '/auth/me': {
    get: operation(
      'getCurrentUser',
      'Current user with its internal roles, read from the database (AA03)',
      {
        output: ref('UserResponse'),
        errors: [401, 403],
        errorDescriptions: {
          401: 'Missing/invalid token or the account no longer exists',
          403: 'Account is not active or has no active role',
        },
      },
    ),
  },
  // AA01: password change and recovery.
  '/auth/password': {
    patch: operation(
      'changePassword',
      'Change the authenticated account password',
      {
        input: 'PasswordChangeRequest',
        status: 204,
        successDescription: 'Password changed',
        errors: [400, 401, 403, 409, 422],
      },
    ),
  },
  '/auth/password-recovery': {
    post: operation(
      'requestPasswordRecovery',
      'Request a password-recovery link without disclosing account existence',
      {
        publicRoute: true,
        input: 'PasswordRecoveryRequest',
        status: 202,
        output: ref('PasswordRecoveryAccepted'),
        errors: [400, 413, 429],
      },
    ),
  },
  '/auth/password-recovery/complete': {
    post: operation(
      'completePasswordRecovery',
      'Set a new password using a valid single-use recovery link',
      {
        publicRoute: true,
        input: 'PasswordRecoveryCompleteRequest',
        status: 204,
        successDescription: 'Password recovery completed',
        errors: [400, 413, 422, 429],
      },
    ),
  },
  // AA02: available only when Google sign-in is configured (GOOGLE_* variables).
  '/auth/google/authorization': {
    post: operation(
      'startGoogleLogin',
      'Start Google sign-in; returns the Google authorization URL and state',
      {
        publicRoute: true,
        output: ref('GoogleAuthorizationResponse'),
        errors: [429],
      },
    ),
  },
  '/auth/google/callback': {
    post: operation(
      'completeGoogleLogin',
      'Complete Google sign-in; establishes the same application session as local login',
      {
        publicRoute: true,
        input: 'GoogleCallbackRequest',
        output: ref('AuthenticationResponse'),
        errors: [400, 401, 403, 409, 413, 429],
        errorDescriptions: {
          401: 'External authentication failed (unknown, expired or reused state, rejected code or invalid ID token)',
          403: 'Account is not active, or no active role is assigned to this account',
          409: 'E-mail already associated with another account',
        },
      },
    ),
  },
  '/users': {
    get: operation(
      'listUsers',
      'List accounts for Administrator management, including the latest invitation method when known',
      {
        parameters: [
          {
            name: 'includeInactive',
            in: 'query',
            required: false,
            schema: { type: 'boolean', default: false },
          },
        ],
        output: { type: 'array', items: ref('UserResponse') },
        errors: [401, 403],
        errorDescriptions: { 403: 'Administrator role required' },
      },
    ),
  },
  '/users/{id}': {
    get: operation(
      'getUser',
      'Get an active or inactive account, including the latest invitation method when known',
      {
        id: true,
        output: ref('UserResponse'),
        errors: [400, 401, 403, 404],
        errorDescriptions: { 403: 'Administrator role required' },
      },
    ),
    delete: operation(
      'deactivateUser',
      'Soft-deactivate a user; preserves historical references',
      {
        id: true,
        status: 204,
        errors: [400, 401, 403, 404, 409],
        errorDescriptions: { 403: 'Administrator role required' },
      },
    ),
  },
  '/users/{id}/roles': {
    patch: operation('replaceUserRoles', 'Replace the complete role set', {
      id: true,
      input: 'UpdateRolesRequest',
      output: ref('UserResponse'),
      errors: [400, 401, 403, 404, 409],
      errorDescriptions: { 403: 'Administrator role required' },
    }),
  },
  '/users/{id}/activation': {
    patch: operation(
      'reactivateUser',
      'Reactivate an account that was previously activated',
      {
        id: true,
        input: 'ActivateAccountRequest',
        output: ref('UserResponse'),
        errors: [400, 401, 403, 404, 409],
        errorDescriptions: { 403: 'Administrator role required' },
      },
    ),
  },
  '/users/{id}/activation-invitations': {
    post: operation(
      'issueActivationInvitation',
      'Issue or replace an activation invitation',
      {
        id: true,
        input: 'InvitationReplacementRequest',
        inputRequired: false,
        output: ref('InvitationResult'),
        errors: [401, 403, 404, 409, 503],
        errorDescriptions: { 403: 'Administrator role required' },
      },
    ),
  },
};
