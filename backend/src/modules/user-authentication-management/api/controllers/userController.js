import { RegisterUserDTO } from '../../application/dtos/RegisterUserDTO.js';
import { UpdateRolesDTO } from '../../application/dtos/UpdateRolesDTO.js';
import { InviteWorkerDTO } from '../../application/dtos/InviteWorkerDTO.js';

export class UserController {
  constructor(userService) {
    this.userService = userService;
  }
  async register(req, res) {
    const user = await this.userService.register(new RegisterUserDTO(req.body));
    res.location(`/api/v1/users/${user.id}`).status(201).json(user);
  }
  async inviteWorker(req, res) {
    const result = await this.userService.inviteWorker(
      new InviteWorkerDTO(req.body),
      req.user,
    );
    res.location(`/api/v1/users/${result.user.id}`).status(201).json(result);
  }
  async getAll(req, res) {
    res.json(
      await this.userService.listUsers(
        req.user,
        req.validatedQuery ?? req.query,
      ),
    );
  }
  async getById(req, res) {
    res.json(await this.userService.getUserById(req.params.id, req.user));
  }
  async updateRoles(req, res) {
    res.json(
      await this.userService.updateRoles(
        req.params.id,
        new UpdateRolesDTO(req.body),
        req.user,
      ),
    );
  }
  async deactivate(req, res) {
    await this.userService.deactivateUser(req.params.id, req.user);
    res.status(204).end();
  }
  async reactivate(req, res) {
    res.json(await this.userService.reactivateUser(req.params.id, req.user));
  }
  async issueInvitation(req, res) {
    res.json(
      await this.userService.issueActivationInvitation(
        req.params.id,
        req.user,
        req.body,
      ),
    );
  }
}
