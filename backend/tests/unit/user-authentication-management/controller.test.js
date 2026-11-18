import { AuthController } from '../../../src/modules/user-authentication-management/api/controllers/authController.js';
import { jest } from '@jest/globals';
import { UserController } from '../../../src/modules/user-authentication-management/api/controllers/userController.js';
import { RegisterUserDTO } from '../../../src/modules/user-authentication-management/application/dtos/RegisterUserDTO.js';
import { LoginDTO } from '../../../src/modules/user-authentication-management/application/dtos/LoginDTO.js';
import { ChangePasswordDTO } from '../../../src/modules/user-authentication-management/application/dtos/ChangePasswordDTO.js';
import { UpdateRolesDTO } from '../../../src/modules/user-authentication-management/application/dtos/UpdateRolesDTO.js';

test('controller maps validated requests to the diagram input DTOs without copying extra properties', async () => {
  const service = {
    register: jest.fn().mockResolvedValue({ id: 'user-id' }),
    login: jest.fn().mockResolvedValue({}),
    changePassword: jest.fn().mockResolvedValue(undefined),
    updateRoles: jest.fn().mockResolvedValue({}),
  };
  const controller = new UserController(service);
  const res = {
    location: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  await controller.register(
    {
      body: {
        name: 'Ana',
        email: 'ana@example.com',
        password: 'long-password',
        roles: ['MANAGER'],
      },
    },
    res,
  );
  const registration = service.register.mock.calls[0][0];
  expect(registration).toBeInstanceOf(RegisterUserDTO);
  expect(registration.marketingConsent).toBe(false);
  expect(registration).not.toHaveProperty('roles');
  await new AuthController(service).login(
    {
      body: {
        email: 'ana@example.com',
        password: 'long-password',
        active: true,
      },
    },
    res,
  );
  expect(service.login.mock.calls[0][0]).toBeInstanceOf(LoginDTO);
  expect(service.login.mock.calls[0][0]).toMatchObject({
    email: 'ana@example.com',
    password: 'long-password',
  });
  expect(service.login.mock.calls[0][0]).not.toHaveProperty('active');
  await new AuthController(service).changePassword(
    {
      body: { currentPassword: 'current', newPassword: 'next-password' },
      user: { sub: 'USR-00001' },
    },
    { status: jest.fn().mockReturnThis(), end: jest.fn() },
  );
  expect(service.changePassword.mock.calls[0][0]).toEqual({
    sub: 'USR-00001',
  });
  expect(service.changePassword.mock.calls[0][1]).toBeInstanceOf(
    ChangePasswordDTO,
  );
  const roles = ['CUSTOMER', 'EMPLOYEE'];
  const actor = { roles: ['MANAGER'] };
  await controller.updateRoles(
    { params: { id: 'user-id' }, body: { roles, active: false }, user: actor },
    res,
  );
  const [id, update, receivedActor] = service.updateRoles.mock.calls[0];
  expect(id).toBe('user-id');
  expect(update).toBeInstanceOf(UpdateRolesDTO);
  expect(update).not.toHaveProperty('active');
  expect(receivedActor).toBe(actor);
  roles.push('MANAGER');
  expect(update.roles).toEqual(['CUSTOMER', 'EMPLOYEE']);
});
