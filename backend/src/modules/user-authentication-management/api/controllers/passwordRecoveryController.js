const genericRequestMessage =
  'If the account is eligible, recovery instructions will be sent.';

export class PasswordRecoveryController {
  constructor(passwordRecoveryService) {
    this.passwordRecoveryService = passwordRecoveryService;
  }

  async requestRecovery(req, res) {
    await this.passwordRecoveryService.requestRecovery(req.body.email);
    res.status(202).json({ message: genericRequestMessage });
  }

  async completeRecovery(req, res) {
    await this.passwordRecoveryService.completeRecovery(
      req.body.linkToken,
      req.body.newPassword,
    );
    res.status(204).end();
  }
}
