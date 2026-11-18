import { InMemoryAuthorizationStateStore } from '../../../src/modules/user-authentication-management/infrastructure/security/InMemoryAuthorizationStateStore.js';

const pending = { provider: 'GOOGLE', nonce: 'n', codeVerifier: 'v' };

describe('AA02 InMemoryAuthorizationStateStore (UT15)', () => {
  test('returns a saved entry exactly once', () => {
    const store = new InMemoryAuthorizationStateStore({ now: () => 1000 });
    store.save('state-1', pending);
    expect(store.consume('state-1')).toEqual({
      ...pending,
      expiresAt: 1000 + 10 * 60 * 1000,
    });
    expect(store.consume('state-1')).toBeNull();
    expect(store.consume('unknown')).toBeNull();
    expect(store.consume(undefined)).toBeNull();
  });

  test('expired entries are never returned', () => {
    let now = 0;
    const store = new InMemoryAuthorizationStateStore({
      ttlMs: 1000,
      now: () => now,
    });
    store.save('state-1', pending);
    now = 999;
    store.save('state-2', pending);
    expect(store.consume('state-1')).not.toBeNull();
    now = 1999;
    expect(store.consume('state-2')).toBeNull();
  });

  test('bounds memory by dropping the oldest pending entry', () => {
    const store = new InMemoryAuthorizationStateStore({ maxEntries: 2 });
    store.save('a', pending);
    store.save('b', pending);
    store.save('c', pending);
    expect(store.consume('a')).toBeNull();
    expect(store.consume('b')).not.toBeNull();
    expect(store.consume('c')).not.toBeNull();
  });

  test('requires a state value', () => {
    const store = new InMemoryAuthorizationStateStore();
    expect(() => store.save('', pending)).toThrow();
  });
});