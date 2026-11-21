import { LoginDTO } from '../../application/dtos/LoginDTO.js';
import { ChangePasswordDTO } from '../../application/dtos/ChangePasswordDTO.js';
import { ExternalCallbackDTO } from '../../application/dtos/ExternalCallbackDTO.js';
import {
  sessionCookieName,
  SESSION_COOKIE_OPTIONS,
} from '../../infrastructure/security/sessionConfig.js';
import { AppError } from '../../../../shared/errors/AppError.js';

function sessionCredential(req, name) {
  const raw = req.headers.cookie;
  if (typeof raw !== 'string') return null;
  const pair = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!pair) return null;
  try {
    return decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    return null;
  }
}

export function sendSession(res, sessionConfig, result, wrap = (auth) => auth) {
  const { sessionCredential: credential, ...publicResult } = result;
  if (credential) {
    res.cookie(sessionCookieName(sessionConfig.cookieSecure), credential, {
      ...SESSION_COOKIE_OPTIONS,
      secure: sessionConfig.cookieSecure,
      maxAge: sessionConfig.idleTimeoutSeconds * 1000,
    });
  }
  res.json(wrap(publicResult));
}

export class AuthController {
  /**
   * @param userService local authentication (AA01)
   * @param externalAuthService Google sign-in (AA02); null when not configured
   */
  constructor(userService, externalAuthService = null, sessionConfig = null) {
    Object.assign(this, { userService, externalAuthService, sessionConfig });
  }
  async #sendSession(res, result) {
    sendSession(res, this.sessionConfig, result);
  }
  async login(req, res) {
    await this.#sendSession(
      res,
      await this.userService.login(new LoginDTO(req.body)),
    );
  }
  // AA03: current internal roles, always read from the database.
  async getCurrentUser(req, res) {
    res.json(await this.userService.getCurrentUser(req.user));
  }
  // GDP01 (G4): give or withdraw marketing consent.
  async updateMarketingConsent(req, res) {
    res.json(
      await this.userService.updateOwnMarketingConsent(
        req.user,
        req.body.marketingConsent,
      ),
    );
  }
  // AA01: change of the local password by the authenticated user.
  async changePassword(req, res) {
    await this.userService.changePassword(
      req.user,
      new ChangePasswordDTO(req.body),
    );
    if (this.sessionConfig) {
      const name = sessionCookieName(this.sessionConfig.cookieSecure);
      res.clearCookie(name, {
        ...SESSION_COOKIE_OPTIONS,
        secure: this.sessionConfig.cookieSecure,
      });
    }
    res.status(204).end();
  }
  // AA02 returns { authorizationUrl, state }.
  async startGoogleLogin(_req, res) {
    res.json(await this.externalAuthService.startAuthorization());
  }
  // AA02 same AuthTokenDTO as local login.
  async completeGoogleLogin(req, res) {
    await this.#sendSession(
      res,
      await this.externalAuthService.completeAuthorization(
        new ExternalCallbackDTO(req.body),
      ),
    );
  }
  async renew(req, res) {
    await this.#sendSession(
      res,
      await this.userService.renew(
        sessionCredential(
          req,
          sessionCookieName(this.sessionConfig.cookieSecure),
        ),
        req.headers['x-csrf-token'],
      ),
    );
  }
  async resume(req, res) {
    if (req.headers.origin !== this.sessionConfig.allowedOrigin)
      throw new AppError('Session resume origin rejected', 403);
    await this.#sendSession(
      res,
      await this.userService.resume(
        sessionCredential(
          req,
          sessionCookieName(this.sessionConfig.cookieSecure),
        ),
      ),
    );
  }
  async logout(req, res) {
    const name = sessionCookieName(this.sessionConfig.cookieSecure);
    await this.userService.logout(
      sessionCredential(req, name),
      req.headers['x-csrf-token'],
    );
    res.clearCookie(name, {
      ...SESSION_COOKIE_OPTIONS,
      secure: this.sessionConfig.cookieSecure,
    });
    res.status(204).end();
  }
}
