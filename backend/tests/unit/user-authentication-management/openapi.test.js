import { openApiSpec } from '../../../src/shared/openapi/spec.js';
const operations = [
  ['/users/register', 'post', 201],
  ['/auth/login', 'post', 200],
  ['/auth/me', 'get', 200],
  ['/auth/password', 'patch', 204],
  ['/auth/password-recovery', 'post', 202],
  ['/auth/password-recovery/complete', 'post', 204],
  ['/users', 'get', 200],
  ['/users/{id}', 'get', 200],
  ['/users/{id}/roles', 'patch', 200],
  ['/users/{id}', 'delete', 204],
];
// Authenticated operations under /auth/: AA01 password change, AA03 current user.
const protectedAuthPaths = ['/auth/password', '/auth/me'];
test.each(operations)(
  'documents %s %s with its success and error contract',
  (path, method, status) => {
    const operation = openApiSpec.paths[path]?.[method];
    expect(operation).toBeDefined();
    expect(operation.responses[status]).toBeDefined();
    expect(operation.responses[500]).toBeDefined();
    if (
      (path.startsWith('/auth/') && !protectedAuthPaths.includes(path)) ||
      path === '/users/register'
    )
      expect(operation.security).toEqual([]);
    else {
      expect(operation.security).toEqual([
        { bearerAuth: [] },
        { accessToken: [] },
      ]);
      expect(operation.responses[401]).toBeDefined();
      if (path !== '/auth/password')
        expect(operation.responses[403]).toBeDefined();
    }
  },
);
test('documents safe output fields and write-only password input', () => {
  const schemas = openApiSpec.components.schemas;
  expect(schemas.UserResponse.properties.passwordHash).toBeUndefined();
  expect(schemas.UserResponse.properties.everActivated).toEqual({
    type: 'boolean',
  });
  expect(schemas.RegisterUserRequest.properties.password.writeOnly).toBe(true);
  expect(schemas.UserResponse.required).toEqual(
    Object.keys(schemas.UserResponse.properties),
  );
  expect(schemas.UserResponse.properties.id).toMatchObject({
    type: 'string',
    pattern: '^USR-[0-9]{5,}$',
    example: 'USR-00001',
  });
  expect(
    openApiSpec.paths['/users/{id}'].get.parameters[0].schema,
  ).toMatchObject({
    pattern: '^USR-[0-9]{5,}$',
    example: 'USR-00001',
  });
});

test('documents recovery request and completion contracts as public operations', () => {
  const requestRecovery = openApiSpec.paths['/auth/password-recovery'].post;
  const completeRecovery =
    openApiSpec.paths['/auth/password-recovery/complete'].post;
  const schemas = openApiSpec.components.schemas;

  expect(
    requestRecovery.responses[202].content['application/json'].schema,
  ).toEqual({
    $ref: '#/components/schemas/PasswordRecoveryAccepted',
  });
  expect(completeRecovery.responses[204].content).toBeUndefined();
  expect(completeRecovery.responses[422]).toBeDefined();
  expect(
    schemas.PasswordRecoveryCompleteRequest.properties.linkToken.writeOnly,
  ).toBe(true);
  expect(
    schemas.PasswordRecoveryCompleteRequest.properties.newPassword.writeOnly,
  ).toBe(true);
  expect(schemas.PasswordRecoveryRequest.additionalProperties).toBe(false);
  expect(schemas.PasswordRecoveryCompleteRequest.additionalProperties).toBe(
    false,
  );
});

test('documents authenticated password change input and response', () => {
  const operation = openApiSpec.paths['/auth/password'].patch;
  const schema = openApiSpec.components.schemas.PasswordChangeRequest;
  expect(operation.security).toEqual([{ bearerAuth: [] }, { accessToken: [] }]);
  expect(operation.requestBody.required).toBe(true);
  expect(operation.responses[204].content).toBeUndefined();
  expect(operation.responses[401]).toBeDefined();
  expect(operation.responses[422]).toBeDefined();
  expect(schema.properties.currentPassword.writeOnly).toBe(true);
  expect(schema.properties.newPassword.writeOnly).toBe(true);
  expect(schema.additionalProperties).toBe(false);
});
// AA02 UT16: Google sign-in operations are public and expose no secrets.
test.each([
  ['/auth/google/authorization', 200, [429]],
  ['/auth/google/callback', 200, [400, 401, 403, 409, 429]],
])('documents public Google operation %s', (path, status, errors) => {
  const operation = openApiSpec.paths[path]?.post;
  expect(operation).toBeDefined();
  expect(operation.security).toEqual([]);
  expect(operation.responses[status]).toBeDefined();
  for (const code of [...errors, 500])
    expect(operation.responses[code]).toBeDefined();
});
test('AA02 Google schemas contain no secret fields', () => {
  const schemas = openApiSpec.components.schemas;
  expect(Object.keys(schemas.GoogleAuthorizationResponse.properties)).toEqual([
    'authorizationUrl',
    'state',
  ]);
  expect(schemas.GoogleCallbackRequest.properties.code.writeOnly).toBe(true);
  expect(JSON.stringify(schemas.GoogleAuthorizationResponse)).not.toMatch(
    /nonce"|verifier"|secret"/i,
  );
});
test.each([
  ['inspect', 'ActivationInvitationRequest', [400, 413, 429]],
  ['local', 'LocalActivationRequest', [400, 409, 413, 429]],
  ['external/start', 'ActivationInvitationRequest', [400, 401, 413, 429]],
  ['external/complete', 'GoogleCallbackRequest', [400, 401, 409, 413, 429]],
])(
  'publishes the public AA07 activation operation %s',
  (path, input, errors) => {
    const operation = openApiSpec.paths[`/users/activation/${path}`]?.post;
    expect(operation.security).toEqual([]);
    expect(operation.requestBody).toMatchObject({
      required: true,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${input}` },
        },
      },
    });
    expect(operation.responses[200].content['application/json']).toBeDefined();
    for (const code of [...errors, 500]) {
      expect(
        operation.responses[code].content['application/json'].schema,
      ).toEqual({
        $ref: '#/components/schemas/ErrorResponse',
      });
    }
  },
);

test('documents optional password setup and the two Google activation results', () => {
  const schemas = openApiSpec.components.schemas;
  expect(schemas.LocalActivationRequest.required).toEqual(['token']);
  expect(schemas.LocalActivationRequest.properties.token).toMatchObject({
    minLength: 43,
    maxLength: 43,
    writeOnly: true,
  });
  expect(schemas.LocalActivationRequest.properties.password.writeOnly).toBe(
    true,
  );
  const response =
    openApiSpec.paths['/users/activation/external/complete'].post
      .responses[200];
  expect(response.content['application/json'].schema.oneOf).toEqual([
    { $ref: '#/components/schemas/ExternalActivationSignedInResponse' },
    { $ref: '#/components/schemas/ExternalActivationOnlyResponse' },
  ]);
  expect(schemas.ExternalActivationSignedInResponse.properties.auth).toEqual({
    $ref: '#/components/schemas/AuthenticationResponse',
  });
  expect(
    schemas.ExternalActivationOnlyResponse.properties.auth,
  ).toBeUndefined();
  expect(response.headers['Set-Cookie'].description).toContain(
    'only with SIGNED_IN',
  );
});

test('UT14: AA03 documents the Table 1 role set and the /auth/me access-denied answer', () => {
  const schemas = openApiSpec.components.schemas;
  expect(schemas.UserResponse.properties.roles).toMatchObject({
    minItems: 0,
    maxItems: 4,
    items: { enum: ['ADMINISTRATOR', 'MANAGER', 'EMPLOYEE', 'CUSTOMER'] },
  });
  expect(schemas.UpdateRolesRequest.properties.roles.items.enum).toContain(
    'ADMINISTRATOR',
  );
  const me = openApiSpec.paths['/auth/me'].get;
  expect(me.responses[200].content['application/json'].schema).toEqual({
    $ref: '#/components/schemas/UserResponse',
  });
  expect(me.responses[403].description).toMatch(/not active|no active role/);
  expect(openApiSpec.paths['/auth/login'].post.responses[403]).toBeDefined();
});
