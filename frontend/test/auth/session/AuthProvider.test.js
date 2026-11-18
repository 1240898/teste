/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../../../src/features/authentication/state/AuthProvider.jsx';
import { useAuth } from '../../../src/features/authentication/state/authContext.js';

const resumeUrl = 'http://localhost:8080/api/v1/auth/resume';
const renewUrl = 'http://localhost:8080/api/v1/auth/renew';
const meUrl = 'http://localhost:8080/api/v1/auth/me';
const logoutUrl = 'http://localhost:8080/api/v1/auth/logout';

const user = {
  id: 'USR-00001',
  name: 'Ana',
  email: 'ana@example.com',
  roles: ['CUSTOMER'],
  active: true,
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function sessionResponse(csrfToken) {
  return jsonResponse(200, {
    accessToken: `access-${csrfToken}`,
    csrfToken,
    idleTimeoutSeconds: 600,
    activityReportIntervalSeconds: 30,
    idleExpiresAt: new Date(Date.now() + 600_000).toISOString(),
    hasLocalCredential: true,
  });
}

function ProtectedProbe({ label }) {
  const auth = useAuth();
  return auth.status === 'authenticated' ? (
    <section>
      <p>{label} protected account data</p>
      <p>
        {label} roles: {auth.user.roles.join(',')}
      </p>
      <button type="button" onClick={() => void auth.logout()}>
        {label} logout
      </button>
    </section>
  ) : (
    <p>
      {label} {auth.message ?? auth.status}
    </p>
  );
}

const channels = new Set();
class TestBroadcastChannel {
  constructor(name) {
    this.name = name;
    channels.add(this);
  }
  postMessage(data) {
    for (const channel of channels) {
      if (channel !== this && channel.name === this.name)
        queueMicrotask(() => channel.onmessage?.({ data }));
    }
  }
  close() {
    channels.delete(this);
  }
}

describe('AA04 browser session restoration and cross-tab logout', () => {
  const originalFetch = globalThis.fetch;
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  let roots;
  let containers;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.BroadcastChannel = TestBroadcastChannel;
    roots = [];
    containers = [];
  });

  afterEach(() => {
    act(() => roots.forEach((root) => root.unmount()));
    containers.forEach((container) => container.remove());
    channels.clear();
    globalThis.fetch = originalFetch;
    if (originalBroadcastChannel === undefined)
      delete globalThis.BroadcastChannel;
    else globalThis.BroadcastChannel = originalBroadcastChannel;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    delete document.documentElement.dataset.authRestorePending;
    jest.useRealTimers();
  });

  function mount(label) {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    containers.push(container);
    roots.push(root);
    root.render(
      <AuthProvider>
        <ProtectedProbe label={label} />
      </AuthProvider>,
    );
    return container;
  }

  test('refreshes roles from /auth/me after renewing the session', async () => {
    jest.useFakeTimers();
    const initialUser = { ...user, roles: ['ADMINISTRATOR'] };
    const refreshedUser = { ...user, roles: ['CUSTOMER'] };
    let meCount = 0;
    globalThis.fetch = jest.fn((url) => {
      if (url === resumeUrl)
        return Promise.resolve({
          ...sessionResponse('csrf-initial'),
          json: async () => ({
            accessToken: 'access-initial',
            csrfToken: 'csrf-initial',
            idleTimeoutSeconds: 600,
            activityReportIntervalSeconds: 1,
            idleExpiresAt: new Date(Date.now() + 600_000).toISOString(),
            hasLocalCredential: true,
          }),
        });
      if (url === meUrl) {
        meCount += 1;
        return Promise.resolve(
          jsonResponse(200, meCount === 1 ? initialUser : refreshedUser),
        );
      }
      if (url === renewUrl)
        return Promise.resolve(
          jsonResponse(200, {
            accessToken: 'access-renewed',
            csrfToken: 'csrf-renewed',
            idleTimeoutSeconds: 600,
            activityReportIntervalSeconds: 1,
            idleExpiresAt: new Date(Date.now() + 600_000).toISOString(),
            hasLocalCredential: true,
          }),
        );
      throw new Error(`Unexpected request: ${url}`);
    });
    document.hasFocus = () => true;

    let container;
    await act(async () => {
      container = mount('renewal');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain('renewal protected account data');
    expect(container.textContent).toContain('renewal roles: ADMINISTRATOR');
    expect(meCount).toBe(1);

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'));
      await jest.advanceTimersByTimeAsync(1001);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      renewUrl,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(meCount).toBe(2);
    expect(container.textContent).toContain('renewal roles: CUSTOMER');
  });

  test('recovers a rotated CSRF token, retries logout, and logs out other tabs only', async () => {
    let resumeCount = 0;
    const logoutCsrfValues = [];
    let rejectStaleLogout;
    globalThis.fetch = jest.fn((url, options = {}) => {
      if (url === resumeUrl) {
        resumeCount += 1;
        if (resumeCount <= 2)
          return Promise.resolve(sessionResponse('csrf-old'));
        if (resumeCount === 3)
          return Promise.resolve(sessionResponse('csrf-current'));
        return Promise.resolve(
          jsonResponse(401, { error: { message: 'Session ended' } }),
        );
      }
      if (url === meUrl) return Promise.resolve(jsonResponse(200, user));
      if (url === logoutUrl) {
        const csrf = options.headers['X-CSRF-Token'];
        logoutCsrfValues.push(csrf);
        if (csrf === 'csrf-old')
          return new Promise((resolve) => {
            rejectStaleLogout = () =>
              resolve(
                jsonResponse(401, {
                  error: { message: 'Invalid CSRF token' },
                }),
              );
          });
        return Promise.resolve(
          csrf === 'csrf-current'
            ? jsonResponse(204, {})
            : jsonResponse(500, {}),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    let firstTab;
    let secondTab;
    await act(async () => {
      firstTab = mount('first');
      secondTab = mount('second');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(firstTab.textContent).toContain('first protected account data');
    expect(secondTab.textContent).toContain('second protected account data');

    await act(async () => {
      firstTab.querySelector('button').click();
      await Promise.resolve();
    });
    expect(firstTab.textContent).not.toContain('protected account data');
    expect(firstTab.textContent).toContain('Signing out');

    await act(async () => {
      rejectStaleLogout();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(logoutCsrfValues).toEqual(['csrf-old', 'csrf-current']);
    expect(firstTab.textContent).not.toContain('protected account data');
    expect(secondTab.textContent).not.toContain('protected account data');
    expect(secondTab.textContent).toContain('second guest');
  });

  test('keeps restored history content hidden until the server rejects the session', async () => {
    let resumeCount = 0;
    let rejectResume;
    globalThis.fetch = jest.fn((url) => {
      if (url === resumeUrl) {
        resumeCount += 1;
        if (resumeCount === 1) return Promise.resolve(sessionResponse('csrf'));
        return new Promise((resolve) => {
          rejectResume = () =>
            resolve(
              jsonResponse(401, { error: { message: 'Invalid session' } }),
            );
        });
      }
      if (url === meUrl) return Promise.resolve(jsonResponse(200, user));
      throw new Error(`Unexpected request: ${url}`);
    });

    let container;
    await act(async () => {
      container = mount('history');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('history protected account data');

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(document.documentElement.dataset.authRestorePending).toBe('true');

    const pageshow = new Event('pageshow');
    Object.defineProperty(pageshow, 'persisted', { value: true });
    await act(async () => {
      window.dispatchEvent(pageshow);
    });
    expect(container.textContent).not.toContain('protected account data');
    expect(document.documentElement.dataset.authRestorePending).toBe('true');

    await act(async () => {
      rejectResume();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).not.toContain('protected account data');
    expect(document.documentElement.dataset.authRestorePending).toBeUndefined();
  });

  test('does not report logout complete when renewal may still be installing a cookie', async () => {
    let resumeCount = 0;
    globalThis.fetch = jest.fn((url) => {
      if (url === resumeUrl) {
        resumeCount += 1;
        if (resumeCount === 1)
          return Promise.resolve(sessionResponse('csrf-old'));
        return Promise.resolve(
          jsonResponse(401, { error: { message: 'Old cookie not current' } }),
        );
      }
      if (url === meUrl) return Promise.resolve(jsonResponse(200, user));
      if (url === logoutUrl)
        return Promise.resolve(
          jsonResponse(401, { error: { message: 'Stale CSRF token' } }),
        );
      throw new Error(`Unexpected request: ${url}`);
    });

    let container;
    await act(async () => {
      container = mount('race');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      container.querySelector('button').click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).not.toContain('protected account data');
    expect(container.textContent).toContain('Logout could not be confirmed');
  });
});
