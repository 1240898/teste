import {
  AuthApiError,
  getCurrentUser,
  parseCurrentUser,
} from '../../../src/features/authentication/services/session/authApi.js';

const validUser = {
  id: 'USR-00007',
  name: 'Rui Costa',
  email: 'rui@example.com',
  roles: ['CUSTOMER', 'MANAGER'],
  active: true,
  marketingConsent: false,
  createdAt: '2026-10-12T09:30:00.000Z',
};
const answer = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('AA03 current user (GET /auth/me)', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('FT01b: parseCurrentUser accepts a well-formed body', () => {
    expect(parseCurrentUser(validUser)).toEqual({
      id: 'USR-00007',
      name: 'Rui Costa',
      email: 'rui@example.com',
      roles: ['CUSTOMER', 'MANAGER'],
      marketingConsent: false,
    });
  });

  test('GDP01: parseCurrentUser keeps the marketing consent (only true counts)', () => {
    expect(
      parseCurrentUser({ ...validUser, marketingConsent: true }).marketingConsent,
    ).toBe(true);
    expect(
      parseCurrentUser({ ...validUser, marketingConsent: 'true' })
        .marketingConsent,
    ).toBe(false);
    expect(
      parseCurrentUser({ ...validUser, marketingConsent: undefined })
        .marketingConsent,
    ).toBe(false);
  });

  test.each([
    ['null body', null],
    ['array body', []],
    ['missing roles', { ...validUser, roles: undefined }],
    ['roles not an array', { ...validUser, roles: 'MANAGER' }],
    ['empty roles', { ...validUser, roles: [] }],
    ['unknown role', { ...validUser, roles: ['ROOT'] }],
    ['duplicated role', { ...validUser, roles: ['MANAGER', 'MANAGER'] }],
    ['inactive account', { ...validUser, active: false }],
    ['active not boolean', { ...validUser, active: 'true' }],
    ['bad id', { ...validUser, id: '7' }],
    ['missing email', { ...validUser, email: undefined }],
  ])('FT01b: parseCurrentUser rejects %s', (_case, body) => {
    expect(() => parseCurrentUser(body)).toThrow(AuthApiError);
  });

  test('getCurrentUser sends the bearer token and validates the answer', async () => {
    global.fetch = jest.fn().mockResolvedValue(answer(200, validUser));
    const user = await getCurrentUser('token-1');
    expect(user.roles).toEqual(['CUSTOMER', 'MANAGER']);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      }),
    );
  });

  test('getCurrentUser rejects malformed answers and keeps back-end errors', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(answer(200, { ...validUser, roles: ['ROOT'] }))
      .mockResolvedValueOnce(
        answer(403, {
          error: { message: 'Account is not active', status: 403 },
        }),
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(getCurrentUser('t')).rejects.toThrow(
      'Invalid current user data',
    );
    await expect(getCurrentUser('t')).rejects.toMatchObject({
      status: 403,
      message: 'Account is not active',
    });
    await expect(getCurrentUser('t')).rejects.toMatchObject({ status: 0 });
    await expect(getCurrentUser('')).rejects.toMatchObject({ status: 401 });
  });
});