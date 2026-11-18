import { sendSession } from './authController.js';

export class ActivationController {
  constructor(service, sessionConfig) {
    Object.assign(this, { service, sessionConfig });
  }

  async inspect(req, res) {
    res.json(await this.service.inspect(req.body.token));
  }

  async local(req, res) {
    const { token, password } = req.body;
    res.json(await this.service.activateLocal(token, password));
  }

  async startExternal(req, res) {
    res.json(await this.service.startExternal(req.body.token));
  }

  async completeExternal(req, res) {
    const { code, state } = req.body;
    const result = await this.service.completeExternal(code, state);
    if (result.status === 'SIGNED_IN') {
      sendSession(res, this.sessionConfig, result.auth, (auth) => ({
        status: result.status,
        auth,
      }));
    } else {
      res.json(result);
    }
  }
}
