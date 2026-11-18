import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminUserApi } from './adminUserApi.js';
import ConfirmationDialog from '../../shared/feedback/ConfirmationDialog.jsx';
import EmptyState from '../../shared/feedback/EmptyState.jsx';
import FeedbackMessage from '../../shared/feedback/FeedbackMessage.jsx';
import LoadingState from '../../shared/feedback/LoadingState.jsx';
import { toFeedback } from '../../shared/feedback/errorMapper.js';
import { useSubmission } from '../../shared/hooks/useSubmission.js';
import { useLocale } from '../../shared/locale/localeContext.js';

const ROLES = ['ADMINISTRATOR', 'MANAGER', 'EMPLOYEE', 'CUSTOMER'];

function sameRoles(left = [], right = []) {
  return (
    left.length === right.length && left.every((role) => right.includes(role))
  );
}

export default function AdminUserManagementPage({ token, refreshSession }) {
  const { locale, t } = useLocale();
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [roles, setRoles] = useState([]);
  const [workerName, setWorkerName] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerRole, setWorkerRole] = useState('EMPLOYEE');
  const [activationMethod, setActivationMethod] = useState('LOCAL');
  const [replacementChoice, setReplacementChoice] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [invitationAttempts, setInvitationAttempts] = useState({});
  const [reconciling, setReconciling] = useState(false);
  const [blockedUntilReload, setBlockedUntilReload] = useState(false);
  const [pendingReview, setPendingReview] = useState(null);
  const { isSubmitting, submit } = useSubmission();
  const selected = users.find((user) => user.id === selectedId);
  const busy = isSubmitting || reconciling || loadState === 'loading';

  const clearUsers = useCallback(() => {
    setUsers([]);
    setSelectedId('');
    setRoles([]);
  }, []);

  const applyRequestError = useCallback(
    (cause) => {
      if (cause?.status === 401 || cause?.status === 403) clearUsers();
      return toFeedback(cause);
    },
    [clearUsers],
  );

  const loadUsers = useCallback(
    async ({ signal } = {}) => {
      setLoadState('loading');
      setLoadError(null);
      try {
        const next = await adminUserApi.list(token, { signal });
        const safeUsers = Array.isArray(next) ? next : [];
        setUsers(safeUsers);
        setPendingReview(null);
        setSelectedId((current) =>
          safeUsers.some((user) => user.id === current)
            ? current
            : (safeUsers[0]?.id ?? ''),
        );
        setLoadState('ready');
        setBlockedUntilReload(false);
        return safeUsers;
      } catch (cause) {
        if (cause?.kind === 'aborted' || signal?.aborted) return null;
        setLoadError(applyRequestError(cause));
        setLoadState('error');
        return null;
      }
    },
    [applyRequestError, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadUsers({ signal: controller.signal });
    return () => controller.abort();
  }, [loadUsers]);

  useEffect(() => setRoles(selected?.roles ?? []), [selected]);

  const showFeedback = useCallback((next) => {
    setFeedback(next);
  }, []);

  const refreshAuthorization = useCallback(async () => {
    const session = await refreshSession();
    if (
      session.status !== 'authenticated' ||
      !session.user?.roles?.includes('ADMINISTRATOR')
    ) {
      clearUsers();
      return false;
    }
    return true;
  }, [clearUsers, refreshSession]);

  const reconcileUnknownAction = useCallback(
    async ({ action, userId, desiredRoles }) => {
      setReconciling(true);
      try {
        const current = await adminUserApi.get(token, userId);
        const wasApplied =
          action === 'roles'
            ? sameRoles(current.roles, desiredRoles)
            : action === 'deactivate'
              ? current.active === false
              : current.active === true;

        if (wasApplied) {
          setUsers((currentUsers) =>
            currentUsers.map((user) =>
              user.id === userId ? { ...user, ...current } : user,
            ),
          );
          if (selectedId === userId && Array.isArray(current.roles))
            setRoles(current.roles);
          showFeedback({ severity: 'success', messageKey: 'userUpdated' });
          setBlockedUntilReload(false);
        } else {
          // Preserve the draft and lock mutations until the administrator
          // explicitly reviews the server state returned by the read-back.
          setBlockedUntilReload(true);
          setPendingReview({ userId, user: current });
          showFeedback({
            severity: 'error',
            messageKey: 'reviewCurrentDataNotice',
          });
        }
      } catch (cause) {
        setBlockedUntilReload(true);
        showFeedback(applyRequestError(cause));
      } finally {
        setReconciling(false);
      }
    },
    [applyRequestError, selectedId, showFeedback, token],
  );

  const reviewPendingData = useCallback(() => {
    if (!pendingReview) return;
    const { userId, user } = pendingReview;
    setUsers((currentUsers) =>
      currentUsers.map((current) =>
        current.id === userId ? { ...current, ...user } : current,
      ),
    );
    if (selectedId === userId && Array.isArray(user.roles))
      setRoles(user.roles);
    setPendingReview(null);
    setBlockedUntilReload(false);
    showFeedback({ severity: 'success', messageKey: 'currentDataReviewed' });
  }, [pendingReview, selectedId, showFeedback]);

  const runAction = useCallback(
    async ({ action, userId, desiredRoles, activationMethod: method }) => {
      if (!userId || blockedUntilReload || busy) return;
      setFeedback(null);
      const operation = async () => {
        if (action === 'roles')
          return adminUserApi.updateRoles(token, userId, desiredRoles);
        if (action === 'deactivate')
          return adminUserApi.deactivate(token, userId);
        if (action === 'reactivate')
          return adminUserApi.reactivate(token, userId);
        return adminUserApi.invite(token, userId, method);
      };

      const outcome = await submit(operation, {
        isSuccessful: (result) =>
          action !== 'invite' || result?.deliveryStatus === 'SENT',
      });

      if (action === 'invite' && outcome.result?.activationMethod) {
        const savedMethod = outcome.result.activationMethod;
        setUsers((current) =>
          current.map((user) =>
            user.id === userId
              ? { ...user, activationMethod: savedMethod }
              : user,
          ),
        );
      }

      if (outcome.phase === 'ignored') return;
      if (outcome.phase === 'outcome_unknown') {
        if (action === 'invite') {
          setInvitationAttempts((current) => ({
            ...current,
            [userId]: 'unknown',
          }));
          showFeedback({
            severity: 'error',
            messageKey: 'invitationOutcomeUnknown',
          });
          return;
        }
        await reconcileUnknownAction({
          action,
          userId,
          desiredRoles,
        });
        return;
      }

      if (outcome.phase === 'failed') {
        if (
          action === 'invite' &&
          outcome.result?.deliveryStatus === 'FAILED'
        ) {
          const retryable = outcome.result.retryable === true;
          setInvitationAttempts((current) => ({
            ...current,
            [userId]: retryable ? 'retryable' : 'terminal',
          }));
          showFeedback({
            severity: 'error',
            messageKey: retryable
              ? 'invitationFailed'
              : 'invitationTerminalFailure',
          });
          return;
        }
        showFeedback(applyRequestError(outcome.error));
        if (outcome.error?.status === 401 || outcome.error?.status === 403)
          return;
        return;
      }

      if (action === 'invite') {
        setInvitationAttempts((current) => ({ ...current, [userId]: 'sent' }));
        showFeedback({
          severity: 'success',
          messageKey: 'invitationSent',
          values: outcome.result?.expiresAt
            ? {
                date: new Date(outcome.result.expiresAt).toLocaleString(locale),
              }
            : undefined,
        });
      } else {
        showFeedback({ severity: 'success', messageKey: 'userUpdated' });
      }

      try {
        if (!(await refreshAuthorization())) return;
      } catch (cause) {
        setFeedback(applyRequestError(cause));
        if (cause?.status === 401 || cause?.status === 403) clearUsers();
        return;
      }
      await loadUsers();
    },
    [
      applyRequestError,
      blockedUntilReload,
      busy,
      clearUsers,
      loadUsers,
      locale,
      reconcileUnknownAction,
      refreshAuthorization,
      showFeedback,
      submit,
      token,
    ],
  );

  const inviteWorker = useCallback(
    async (event) => {
      event.preventDefault();
      if (busy || blockedUntilReload) return;
      setFeedback(null);
      const outcome = await submit(
        () =>
          adminUserApi.inviteWorker(token, {
            name: workerName,
            email: workerEmail,
            role: workerRole,
            activationMethod,
          }),
        {
          isSuccessful: (result) =>
            result?.invitationDelivery?.deliveryStatus !== 'FAILED',
        },
      );
      if (outcome.phase === 'ignored') return;
      if (outcome.phase === 'outcome_unknown') {
        showFeedback({
          severity: 'error',
          messageKey: 'invitationOutcomeUnknown',
        });
        return;
      }
      if (outcome.phase === 'failed') {
        if (outcome.result?.invitationDelivery?.deliveryStatus === 'FAILED')
          showFeedback({ severity: 'error', messageKey: 'invitationFailed' });
        else showFeedback(applyRequestError(outcome.error));
      } else if (
        outcome.result?.invitationDelivery?.deliveryStatus === 'SENT'
      ) {
        showFeedback({
          severity: 'success',
          messageKey: 'invitationSent',
          values: outcome.result.invitationDelivery.expiresAt
            ? {
                date: new Date(
                  outcome.result.invitationDelivery.expiresAt,
                ).toLocaleString(locale),
              }
            : undefined,
        });
      } else {
        showFeedback({
          severity: 'success',
          messageKey: 'workerAccountUpdated',
        });
      }
      try {
        if (!(await refreshAuthorization())) return;
      } catch (cause) {
        setFeedback(applyRequestError(cause));
        if (cause?.status === 401 || cause?.status === 403) clearUsers();
        return;
      }
      await loadUsers();
    },
    [
      activationMethod,
      applyRequestError,
      blockedUntilReload,
      busy,
      clearUsers,
      loadUsers,
      locale,
      refreshAuthorization,
      showFeedback,
      submit,
      token,
      workerEmail,
      workerName,
      workerRole,
    ],
  );

  const replacementActivationMethod =
    replacementChoice?.userId === selected?.id
      ? (replacementChoice?.method ?? '')
      : '';

  const requestAction = useCallback(
    (action, userId = selected?.id, desiredRoles = roles) => {
      if (!userId || busy || blockedUntilReload) return;
      if (
        action === 'invite' &&
        !selected?.activationMethod &&
        !replacementActivationMethod
      )
        return;
      setFeedback(null);
      setConfirmation({
        action,
        userId,
        desiredRoles,
        activationMethod:
          action === 'invite' && !selected?.activationMethod
            ? replacementActivationMethod
            : undefined,
      });
    },
    [
      blockedUntilReload,
      busy,
      replacementActivationMethod,
      roles,
      selected?.activationMethod,
      selected?.id,
    ],
  );

  const invitationState = invitationAttempts[selected?.id];
  const roleDraftChanged = useMemo(
    () => Boolean(selected) && !sameRoles(roles, selected.roles),
    [roles, selected],
  );
  const confirmationMessage =
    confirmation?.action === 'deactivate'
      ? 'confirmDeactivateWarning'
      : confirmation?.action === 'reactivate'
        ? 'confirmReactivateWarning'
        : confirmation?.action === 'roles'
          ? 'confirmRolesWarning'
          : ['unknown', 'retryable'].includes(
                invitationAttempts[confirmation?.userId],
              )
            ? 'invitationReplacementWarning'
            : 'confirmInvitationWarning';

  return (
    <section className="admin-users" aria-labelledby="admin-users-title">
      <h1 id="admin-users-title">{t('userManagement')}</h1>
      <p>{t('userManagementIntro')}</p>

      <form className="admin-invite-form" onSubmit={inviteWorker}>
        <h2>{t('inviteWorker')}</h2>
        <label htmlFor="worker-name">{t('name')}</label>
        <input
          id="worker-name"
          autoComplete="name"
          required
          maxLength={100}
          value={workerName}
          disabled={busy || blockedUntilReload}
          onChange={(event) => setWorkerName(event.target.value)}
        />
        <label htmlFor="worker-email">{t('email')}</label>
        <input
          id="worker-email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={workerEmail}
          disabled={busy || blockedUntilReload}
          onChange={(event) => setWorkerEmail(event.target.value)}
        />
        <label htmlFor="worker-role">{t('workerRole')}</label>
        <select
          id="worker-role"
          value={workerRole}
          disabled={busy || blockedUntilReload}
          onChange={(event) => setWorkerRole(event.target.value)}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`role${role}`)}
            </option>
          ))}
        </select>
        <label htmlFor="activation-method">{t('activationMethod')}</label>
        <select
          id="activation-method"
          value={activationMethod}
          disabled={busy || blockedUntilReload}
          onChange={(event) => setActivationMethod(event.target.value)}
        >
          <option value="LOCAL">{t('localActivation')}</option>
          <option value="EXTERNAL">{t('googleActivation')}</option>
        </select>
        <button
          className="button button--primary"
          type="submit"
          disabled={busy || blockedUntilReload}
        >
          {t(isSubmitting ? 'wait' : 'inviteWorker')}
        </button>
      </form>

      {loadState === 'loading' && <LoadingState labelKey="loadingUsers" />}
      {loadState === 'error' && (
        <>
          <FeedbackMessage
            severity="error"
            messageKey={loadError?.messageKey ?? 'unknownMessage'}
          />
          <button
            className="button button--secondary"
            type="button"
            disabled={busy}
            onClick={() => void loadUsers()}
          >
            {t('retryUsers')}
          </button>
        </>
      )}
      {loadState === 'ready' && users.length === 0 && (
        <EmptyState titleKey="noAccounts" />
      )}

      {loadState === 'ready' && users.length > 0 && (
        <>
          <label htmlFor="managed-user">{t('account')}</label>
          <select
            id="managed-user"
            value={selectedId}
            disabled={busy || blockedUntilReload}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setFeedback(null);
            }}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.email} ·{' '}
                {t(user.active ? 'active' : 'inactive')}
              </option>
            ))}
          </select>
          {selected && (
            <>
              <fieldset disabled={busy || blockedUntilReload}>
                <legend>{t('rolesFor', { name: selected.name })}</legend>
                {ROLES.map((role) => (
                  <label className="admin-role" key={role}>
                    <input
                      type="checkbox"
                      checked={roles.includes(role)}
                      onChange={(event) => {
                        setRoles((current) =>
                          event.target.checked
                            ? [...current, role]
                            : current.filter((item) => item !== role),
                        );
                        setFeedback(null);
                      }}
                    />
                    {t(`role${role}`)}
                  </label>
                ))}
              </fieldset>
              {blockedUntilReload && (
                <>
                  <FeedbackMessage
                    severity="error"
                    messageKey={
                      pendingReview
                        ? 'reviewCurrentDataNotice'
                        : (feedback?.messageKey ?? 'requestUnconfirmed')
                    }
                  />
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      pendingReview ? reviewPendingData() : void loadUsers()
                    }
                  >
                    {t(pendingReview ? 'reviewCurrentData' : 'retryUsers')}
                  </button>
                </>
              )}
              <div className="form-actions">
                {!selected.active &&
                  !selected.everActivated &&
                  !selected.activationMethod && (
                    <label htmlFor="replacement-activation-method">
                      {t('unknownActivationMethod')}
                      <select
                        id="replacement-activation-method"
                        value={replacementActivationMethod}
                        disabled={busy || blockedUntilReload}
                        onChange={(event) =>
                          setReplacementChoice({
                            userId: selected.id,
                            method: event.target.value,
                          })
                        }
                      >
                        <option value="" disabled>
                          {t('chooseActivationMethod')}
                        </option>
                        <option value="LOCAL">{t('localActivation')}</option>
                        <option value="EXTERNAL">
                          {t('googleActivation')}
                        </option>
                      </select>
                    </label>
                  )}
                {selected.active ? (
                  <button
                    className="button button--danger"
                    type="button"
                    disabled={busy || blockedUntilReload}
                    onClick={() => requestAction('deactivate')}
                  >
                    {t('deactivate')}
                  </button>
                ) : selected.everActivated ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={busy || blockedUntilReload}
                    onClick={() => requestAction('reactivate')}
                  >
                    {t('reactivate')}
                  </button>
                ) : invitationState !== 'terminal' ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={
                      busy ||
                      blockedUntilReload ||
                      (!selected.activationMethod &&
                        !replacementActivationMethod)
                    }
                    onClick={() => requestAction('invite')}
                  >
                    {t(
                      invitationState === 'retryable' ||
                        invitationState === 'unknown'
                        ? 'retryInvitation'
                        : 'invite',
                    )}
                  </button>
                ) : null}
                <button
                  className="button button--primary"
                  type="button"
                  disabled={busy || blockedUntilReload || !roleDraftChanged}
                  onClick={() => requestAction('roles')}
                >
                  {t(isSubmitting ? 'wait' : 'saveRoles')}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {!blockedUntilReload && (
        <FeedbackMessage
          severity={feedback?.severity}
          messageKey={feedback?.messageKey}
          values={feedback?.values}
        />
      )}
      {isSubmitting && <LoadingState labelKey="processingAction" />}

      <ConfirmationDialog
        open={Boolean(confirmation)}
        consequenceKey={confirmationMessage}
        confirmLabelKey={
          confirmation?.action === 'invite' ? 'sendInvitation' : 'confirm'
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          const current = confirmation;
          setConfirmation(null);
          if (current) void runAction(current);
        }}
      />
    </section>
  );
}
