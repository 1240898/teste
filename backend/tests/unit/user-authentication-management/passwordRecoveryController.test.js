import { jest } from '@jest/globals';
import { PasswordRecoveryController } from '../../../src/modules/user-authentication-management/api/controllers/passwordRecoveryController.js';

describe('PasswordRecoveryController', () => {
  test('returns the same accepted message after requesting a link', async () => {
    const service = { requestRecovery: jest.fn().mockResolvedValue(undefined) };
    const controller = new PasswordRecoveryController(service);
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.requestRecovery(
      { body: { email: 'ana@example.com' } },
      response,
    );

    expect(service.requestRecovery).toHaveBeenCalledWith('ana@example.com');
    expect(response.status).toHaveBeenCalledWith(202);
    expect(response.json).toHaveBeenCalledWith({
      message:
        'If the account is eligible, recovery instructions will be sent.',
    });
  });

  test('returns no content after completing password recovery', async () => {
    const service = {
      completeRecovery: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new PasswordRecoveryController(service);
    const response = {
      status: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };

    await controller.completeRecovery(
      {
        body: {
          linkToken: 'one-time-secret',
          newPassword: 'NewStrongPass123!',
        },
      },
      response,
    );

    expect(service.completeRecovery).toHaveBeenCalledWith(
      'one-time-secret',
      'NewStrongPass123!',
    );
    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.end).toHaveBeenCalledTimes(1);
  });
});
