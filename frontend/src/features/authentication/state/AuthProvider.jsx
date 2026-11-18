import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setAuthFailureHandler } from '../../../shared/api/apiClient.js';
import { AuthContext } from './authContext.js';
import {
  guestSession,
  hasAnyRole,
  loadCurrentSession,
  startSession,
} from './authSession.js';
import {
  logoutSession,
  renewSession,
  resumeSession,
  hasCrossTabSessionLock,
  withSessionOperationLock,
} from '../services/session/authApi.js';

const LOGOUT_CHANNEL = 'laprizza-auth-session';
const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';

async function endCurrentSession(csrfToken, crossTabSerialized) {
  if (!csrfToken) {
    const current = await resumeSession();
    if (!current.csrfToken) throw new Error('No current CSRF token');
    await logoutSession(current.csrfToken);
    return;
  }

  try {
    await logoutSession(csrfToken);
  } catch (error) {
    if (error?.status !== 401) throw error;

    // Another tab may have rotated the shared cookie and CSRF token. Resume
    // through that cookie, then retry logout once with the current CSRF value.
    let current;
    try {
      current = await resumeSession();
    } catch (resumeError) {
      // With a cross-tab lock held, a rejected resume means no competing
      // renewal can still install a newer cookie, so the session is ended.
      if (resumeError?.status === 401 && crossTabSerialized) return;
      throw resumeError;
    }
    if (!current.csrfToken) throw new Error('No current CSRF token');
    await logoutSession(current.csrfToken);
  }
}

/**
 * AA03: keeps the current user and its internal roles as returned by
 * GET /auth/me. Roles are never decoded from the JWT nor chosen by the user.
 * The access JWT and CSRF value stay in memory; AA04 resumes renewal credentials
 * from the browser-managed HttpOnly cookie.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState({
    ...guestSession,
    status: 'loading',
  });
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const generation = useRef(0);
  const lastActivity = useRef(Date.now());
  const lastReported = useRef(Date.now());
  const renewing = useRef(false);
  const roleRefresh = useRef(null);
  const logoutChannel = useRef(null);

  const resetActivityWindow = useCallback((authToken) => {
    const now = Date.now();
    const idleMs = Number(authToken?.idleTimeoutSeconds) * 1000;
    const remainingMs = Date.parse(authToken?.idleExpiresAt) - now;
    const elapsedMs = Number.isFinite(remainingMs)
      ? Math.max(0, idleMs - Math.max(0, remainingMs))
      : 0;
    lastActivity.current = now - elapsedMs;
    lastReported.current = now;
  }, []);

  const restoreFromCookie = useCallback(
    async (isAlive = () => true) => {
      const current = ++generation.current;
      setSession({ ...guestSession, status: 'loading' });
      try {
        const authToken = await resumeSession();
        const restored = await startSession(authToken);
        if (!isAlive() || generation.current !== current) return;
        if (restored.status === 'authenticated') resetActivityWindow(restored);
        setSession(restored);
      } catch (error) {
        if (!isAlive() || generation.current !== current) return;
        setSession(
          error?.status === 403
            ? { ...guestSession, status: 'denied', message: error.message }
            : {
                ...guestSession,
                message:
                  error?.status === 401
                    ? null
                    : 'Your session could not be restored. Please sign in again.',
              },
        );
      } finally {
        if (isAlive() && generation.current === current)
          delete document.documentElement.dataset.authRestorePending;
      }
    },
    [resetActivityWindow],
  );

  useEffect(() => {
    let alive = true;
    void restoreFromCookie(() => alive);
    return () => {
      alive = false;
    };
  }, [restoreFromCookie]);

  // A logout in one tab invalidates the shared browser session. Broadcast only
  // the event, never credentials; other devices have their own cookie/session.
  useEffect(() => {
    if (typeof BroadcastChannel !== 'function') return undefined;
    const channel = new BroadcastChannel(LOGOUT_CHANNEL);
    logoutChannel.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type !== 'logout') return;
      document.documentElement.dataset.authRestorePending = 'true';
      void restoreFromCookie();
    };
    return () => {
      logoutChannel.current = null;
      channel.close();
      delete document.documentElement.dataset.authRestorePending;
    };
  }, [restoreFromCookie]);

  // BFCache can restore the old DOM and React state without remounting. Hide
  // the document before it is cached, then resume against the server on return.
  useEffect(() => {
    const onPageHide = () => {
      if (sessionRef.current.status === 'authenticated')
        document.documentElement.dataset.authRestorePending = 'true';
    };
    const onPageShow = (event) => {
      if (!event.persisted) return;
      document.documentElement.dataset.authRestorePending = 'true';
      void restoreFromCookie();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [restoreFromCookie]);

  // Receives the AuthTokenDTO of a successful sign-in (Google now, local in AA01).
  const acceptAuthToken = useCallback(
    async (authToken) => {
      generation.current += 1;
      const current = generation.current;
      setSession({ ...guestSession, status: 'loading' });
      const next = await startSession(authToken);
      if (generation.current !== current) return guestSession;
      resetActivityWindow(authToken);
      setSession(next);
      return next;
    },
    [resetActivityWindow],
  );

  // Re-reads the roles from the back end (e.g. after an Administrator change).
  const refresh = useCallback(async (expectedToken) => {
    const previous = sessionRef.current;
    const current = generation.current;
    if (
      previous.status !== 'authenticated' ||
      (expectedToken && expectedToken !== previous.token)
    )
      return guestSession;

    const pending = roleRefresh.current;
    if (pending?.generation === current && pending.token === previous.token)
      return pending.promise;

    const promise = loadCurrentSession(previous.token).then((next) => {
      if (
        generation.current !== current ||
        sessionRef.current.token !== previous.token
      )
        return guestSession;
      const refreshed = {
        ...previous,
        ...next,
        // A denied account can still explicitly end its cookie-backed session.
        csrfToken: previous.csrfToken,
      };
      setSession((latest) =>
        generation.current === current && latest.token === previous.token
          ? refreshed
          : latest,
      );
      return refreshed;
    });
    roleRefresh.current = {
      generation: current,
      token: previous.token,
      promise,
    };
    try {
      return await promise;
    } finally {
      if (roleRefresh.current?.promise === promise) roleRefresh.current = null;
    }
  }, []);

  const discardSession = useCallback((message = null) => {
    generation.current += 1;
    setSession({ ...guestSession, message });
  }, []);

    /**
   * WEB03 (section 3.4, table B): reaction to a 401/403 answered by a BUSINESS
   * request (authentication requests never reach it, BR 13).
   * - 401: terminal. The session is discarded; no /auth/me, no retry.
   * - 403: one single-flight refresh(); its /auth/me answer is mapped by
   *   loadCurrentSession and never calls this handler again.
   * Answers for another (older) token, or without a token, are ignored.
   */
  const handleAuthFailure = useCallback(
    async (status, { accessToken } = {}) => {
      const current = sessionRef.current;
      if (
        current.status !== 'authenticated' ||
        !accessToken ||
        accessToken !== current.token
      )
        return;
      if (status === 401) {
        discardSession(SESSION_EXPIRED_MESSAGE);
        return;
      }
      if (status === 403) await refresh(accessToken);
    },
    [discardSession, refresh],
  );

  useEffect(
    () => setAuthFailureHandler(handleAuthFailure),
    [handleAuthFailure],
  );

  // WEB03 (D4): roles changed elsewhere are re-read when the user returns to
  // the window. refresh() is single-flight, so repeated events share a request.
  useEffect(() => {
    if (session.status !== 'authenticated' || !session.token) return undefined;
    const token = session.token;
    const onReturn = () => {
      if (document.visibilityState === 'visible') void refresh(token);
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [session.status, session.token, refresh]);

  const logout = useCallback(
    async (message = null) => {
      generation.current += 1;
      const current = generation.current;
      const csrfToken = session.csrfToken;
      setSession({
        ...guestSession,
        status: 'logoutPending',
        message: 'Signing out…',
        csrfToken,
      });
      try {
        await withSessionOperationLock(() =>
          endCurrentSession(csrfToken, hasCrossTabSessionLock()),
        );
        logoutChannel.current?.postMessage({ type: 'logout' });
        if (generation.current === current)
          setSession({ ...guestSession, message });
        return true;
      } catch {
        if (generation.current === current)
          setSession({
            ...guestSession,
            status: 'logoutPending',
            csrfToken,
            message: 'Logout could not be confirmed. Retry logout.',
          });
        return false;
      }
    },
    [session.csrfToken],
  );

  useEffect(() => {
    if (
      session.status !== 'authenticated' ||
      !session.token ||
      !session.csrfToken ||
      !Number.isFinite(session.activityReportIntervalSeconds) ||
      !Number.isFinite(session.idleTimeoutSeconds)
    )
      return undefined;
    const current = generation.current;
    const intervalMs = session.activityReportIntervalSeconds * 1000;
    const idleMs = session.idleTimeoutSeconds * 1000;
    const noteActivity = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener('pointerdown', noteActivity, { passive: true });
    window.addEventListener('pointermove', noteActivity, { passive: true });
    window.addEventListener('keydown', noteActivity);
    window.addEventListener('wheel', noteActivity, { passive: true });
    window.addEventListener('touchstart', noteActivity, { passive: true });
    const timer = window.setInterval(
      async () => {
        const now = Date.now();
        if (
          document.visibilityState !== 'visible' ||
          document.hasFocus() === false ||
          renewing.current
        )
          return;
        if (now - lastActivity.current >= idleMs) {
          generation.current += 1;
                    setSession({ ...guestSession, message: SESSION_EXPIRED_MESSAGE });
          return;
        }
        if (
          now - lastActivity.current > intervalMs ||
          now - lastReported.current < intervalMs
        )
          return;
        renewing.current = true;
        try {
          await withSessionOperationLock(async () => {
            try {
              const renewed = await renewSession(session.csrfToken);
              if (generation.current === current) {
                const refreshed = await startSession(renewed);
                if (generation.current !== current) return;
                lastReported.current = Date.now();
                setSession(refreshed);
              }
            } catch (error) {
              // Renewal rotates the shared cookie and CSRF value. The Web Lock
              // serializes this with other tabs' logout and renewal requests.
              if (generation.current === current && error?.status === 401) {
                try {
                  const resumed = await resumeSession();
                  const restored = await startSession(resumed);
                  if (
                    generation.current === current &&
                    restored.status === 'authenticated'
                  ) {
                    resetActivityWindow(restored);
                    lastReported.current = Date.now();
                    setSession(restored);
                    return;
                  }
                } catch {
                  // An invalid or expired cookie follows the fail-closed path.
                }
              }
              if (
                generation.current === current &&
                [401, 403].includes(error?.status)
              ) {
                generation.current += 1;
                                setSession({
                  ...guestSession,
                  message: SESSION_EXPIRED_MESSAGE,
                });
              }
            }
          });
        } finally {
          renewing.current = false;
        }
      },
      Math.max(1000, Math.min(intervalMs, 5000)),
    );
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', noteActivity);
      window.removeEventListener('pointermove', noteActivity);
      window.removeEventListener('keydown', noteActivity);
      window.removeEventListener('wheel', noteActivity);
      window.removeEventListener('touchstart', noteActivity);
    };
  }, [
    session.status,
    session.token,
    session.csrfToken,
    session.idleTimeoutSeconds,
    session.activityReportIntervalSeconds,
    resetActivityWindow,
  ]);

  const value = useMemo(
    () => ({
      ...session,
      acceptAuthToken,
      refresh,
      logout,
      discardSession,
      hasAnyRole: (...roles) => hasAnyRole(session, roles),
    }),
    [session, acceptAuthToken, refresh, logout, discardSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
