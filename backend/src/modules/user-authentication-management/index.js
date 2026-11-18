import { Router } from 'express';
import { AuthController } from './api/controllers/authController.js';
import { AuthRoutes } from './api/routes/authRoutes.js';
import { PasswordRecoveryController } from './api/controllers/passwordRecoveryController.js';
import { PasswordRecoveryRoutes } from './api/routes/passwordRecoveryRoutes.js';
import { createPublicRateLimiter } from './api/routes/publicRateLimiter.js';
import { UserRepository } from './infrastructure/persistence/UserRepository.js';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher.js';
import { JwtTokenService } from './infrastructure/security/JwtTokenService.js';
import { SessionCredentialService } from './infrastructure/security/SessionCredentialService.js';
import { PostgresApplicationSessionRepository } from './infrastructure/persistence/PostgresApplicationSessionRepository.js';
import { InMemoryApplicationSessionRepository } from './infrastructure/security/InMemoryApplicationSessionRepository.js';
import { loadSessionConfig } from './infrastructure/security/sessionConfig.js';
import { randomUUID } from 'node:crypto';
import { GoogleOidcProvider } from './infrastructure/security/GoogleOidcProvider.js';
import { InMemoryAuthorizationStateStore } from './infrastructure/security/InMemoryAuthorizationStateStore.js';
import { UserService } from './application/services/UserService.js';
import { PasswordRecoveryService } from './application/services/PasswordRecoveryService.js';
import { ExternalAuthenticationService } from './application/services/ExternalAuthenticationService.js';
import { UserController } from './api/controllers/userController.js';
import { UserRoutes } from './api/routes/userRoutes.js';
import { AuthMiddleware } from './api/middlewares/authMiddleware.js';
import { loadSecurityConfig } from '../../shared/security/config.js';
import { PostgresUnitOfWork } from '../../shared/persistence/postgres/PostgresUnitOfWork.js';
import { PostgresRecoveryTokenRepository } from './infrastructure/persistence/PostgresRecoveryTokenRepository.js';
import { RecoveryTokenServiceAdapter } from './infrastructure/security/RecoveryTokenService.js';
import { SmtpRecoveryDeliveryAdapter } from './infrastructure/security/SmtpRecoveryDeliveryAdapter.js';
import { loadPasswordRecoveryConfig } from './infrastructure/security/passwordRecoveryConfig.js';
import { RoleChangeRecordRepository } from './infrastructure/persistence/RoleChangeRecordRepository.js';
import { ActivationInvitationRepository } from './infrastructure/persistence/ActivationInvitationRepository.js';
import { ActivationInvitationTokenService } from './infrastructure/security/ActivationInvitationTokenService.js';
import { SmtpInvitationDeliveryAdapter } from './infrastructure/security/SmtpInvitationDeliveryAdapter.js';
import { loadActivationInvitationConfig } from './infrastructure/security/activationInvitationConfig.js';
import { PostgresActivationLock } from './infrastructure/persistence/PostgresActivationLock.js';
import { PostgresAuthorizationStateStore } from './infrastructure/persistence/PostgresAuthorizationStateStore.js';
import { ActivationService } from './application/services/ActivationService.js';
import { ActivationController } from './api/controllers/activationController.js';
import { createActivationRoutes } from './api/routes/activationRoutes.js';
export function createUserModule({
  database,
  repository = new UserRepository(database),
  security = loadSecurityConfig(),
  rateLimit,
  // AA02: Google sign-in configuration is passed by the composition root
  // (backend/index.js reads GOOGLE_*); tests may inject a fake identityProvider.
  externalIdentity = null,
  identityProvider,
  stateStore = database
    ? new PostgresAuthorizationStateStore(database)
    : new InMemoryAuthorizationStateStore(),
  logger = console,
  requestActivationInvitation,
  invitationDelivery: injectedInvitationDelivery,
  sessionConfig,
} = {}) {
  if (identityProvider === undefined)
    identityProvider = externalIdentity
      ? new GoogleOidcProvider(externalIdentity)
      : null;
  const hasher = new BcryptPasswordHasher();
  const sessionsConfig =
    sessionConfig ??
    (database && process.env.NODE_ENV !== 'test'
      ? loadSessionConfig()
      : {
          idleTimeoutSeconds: 172800,
          activityReportIntervalSeconds: 60,
          sessionRetentionSeconds: 604800,
          cookieSecure: false,
          allowedOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
          accessTokenTtl: security.expiresIn,
        });
  const tokens = new JwtTokenService({
    ...security,
    expiresIn: sessionsConfig.accessTokenTtl,
  });
  const sessions =
    database && process.env.NODE_ENV !== 'test'
      ? new PostgresApplicationSessionRepository(database)
      : new InMemoryApplicationSessionRepository();
  const credentials = new SessionCredentialService();
  if (process.env.NODE_ENV === 'test') {
    const issue = tokens.generateToken.bind(tokens);
    tokens.generateToken = (payload) => {
      if (!payload.sid && typeof payload.sub === 'string') {
        const sid = randomUUID();
        sessions.registerTestSession(
          sid,
          payload.sub,
          sessionsConfig.idleTimeoutSeconds,
        );
        return issue({ sub: payload.sub, sid });
      }
      return issue(payload);
    };
  }
  const aa06 = {};
  let activationConfig;
  let invitationDelivery;
  let invitationTokenService;
  if (database) {
    aa06.unitOfWork = new PostgresUnitOfWork(database);
    aa06.activationLock = new PostgresActivationLock();
    aa06.roleChangeRepository = new RoleChangeRecordRepository(database);
    aa06.invitationRepository = new ActivationInvitationRepository(database);
    activationConfig = loadActivationInvitationConfig();
    invitationDelivery =
      injectedInvitationDelivery ??
      new SmtpInvitationDeliveryAdapter(loadPasswordRecoveryConfig().smtp);
    invitationTokenService = new ActivationInvitationTokenService();
  }
  const userService = new UserService(
    repository,
    hasher,
    tokens,
    requestActivationInvitation ?? null,
    sessions,
    credentials,
    sessionsConfig,
    {
      ...aa06,
      invitationDelivery,
      invitationTokenService,
      invitationValiditySeconds: activationConfig?.validitySeconds,
      invitationWebUrl: activationConfig?.webUrl,
    },
  );
  const sessionCleanupTimer =
    database && process.env.NODE_ENV !== 'test'
      ? setInterval(
          () => {
            sessions
              .purgeEnded(sessionsConfig.sessionRetentionSeconds)
              .catch(() =>
                logger.warn?.('Expired application-session cleanup failed'),
              );
            if (identityProvider)
              stateStore
                .purgeExpired?.()
                .catch(() =>
                  logger.warn?.('Expired OAuth state cleanup failed'),
                );
          },
          60 * 60 * 1000,
        )
      : null;
  sessionCleanupTimer?.unref();
  const externalAuthService = identityProvider
    ? new ExternalAuthenticationService(
        repository,
        identityProvider,
        stateStore,
        userService,
        logger,
        aa06,
      )
    : null;
  const controller = new UserController(userService);
  const limiter = createPublicRateLimiter(rateLimit);
  // Shared by AuthRoutes (AA01 /auth/password, AA03 /auth/me) and UserRoutes.
  const authMiddleware = new AuthMiddleware(userService);
  const router = Router();
  router.use(
    new AuthRoutes(
      new AuthController(userService, externalAuthService, sessionsConfig),
      limiter,
      authMiddleware,
    ).setupRoutes(),
  );
  let passwordRecoveryService;
  if (database) {
    const activationService = new ActivationService({
      ...aa06,
      userRepository: repository,
      tokenService: invitationTokenService,
      passwordHasher: hasher,
      externalAuthService,
      userService,
    });
    router.use(
      createActivationRoutes(
        new ActivationController(activationService, sessionsConfig),
        limiter,
      ),
    );
    const recoveryConfig = loadPasswordRecoveryConfig();
    passwordRecoveryService = new PasswordRecoveryService({
      userRepository: repository,
      recoveryRepository: new PostgresRecoveryTokenRepository(database),
      tokenService: new RecoveryTokenServiceAdapter(),
      passwordHasher: hasher,
      delivery: new SmtpRecoveryDeliveryAdapter(recoveryConfig.smtp),
      unitOfWork: new PostgresUnitOfWork(database),
      sessions,
      validitySeconds: recoveryConfig.validitySeconds,
      webUrl: recoveryConfig.webUrl,
    });
    router.use(
      new PasswordRecoveryRoutes(
        new PasswordRecoveryController(passwordRecoveryService),
        limiter,
      ).setupRoutes(),
    );
  }
  router.use(new UserRoutes(controller, authMiddleware, limiter).setupRoutes());
  return {
    router,
    userService,
    externalAuthService,
    hasher,
    tokens,
    sessions,
    credentials,
    dispose: () => clearInterval(sessionCleanupTimer),
    passwordRecoveryService,
  };
}
export function register(router, module) {
  // Production supplies the fully wired module before listening.
  if (module) router.use(module.router);
}
