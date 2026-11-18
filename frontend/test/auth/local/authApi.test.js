import { authApi } from '../../../src/features/authentication/services/authApi.js';

describe('authApi.changePassword', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the current and new password with the authenticated bearer token', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 204, ok: true });

    await expect(
      authApi.changePassword('access-token', 'current-secret', 'new-secret'),
    ).resolves.toBeNull();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/auth/password',
      expect.objectContaining({
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer access-token',
        },
        body: JSON.stringify({
          currentPassword: 'current-secret',
          newPassword: 'new-secret',
        }),
      }),
    );
  });
});
