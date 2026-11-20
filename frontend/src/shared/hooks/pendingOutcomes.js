
// Operations whose result is unknown (timeout, network, 5xx) and that must not
// be repeated until the user confirms the real result (WEB05 BR25).
// Kept in sessionStorage so the block survives leaving and returning to the page.
const PREFIX = 'pending-outcome:';

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const pendingOutcomes = {
  has(key) {
    if (!key) return false;
    try {
      return storage()?.getItem(PREFIX + key) != null;
    } catch {
      return false;
    }
  },

  add(key, details = {}) {
    if (!key) return;
    try {
      storage()?.setItem(
        PREFIX + key,
        JSON.stringify({ ...details, at: Date.now() }),
      );
    } catch {
      /* storage unavailable: the in-memory block still applies */
    }
  },

  remove(key) {
    if (!key) return;
    try {
      storage()?.removeItem(PREFIX + key);
    } catch {
      /* nothing stored */
    }
  },

  /** Every pending outcome whose key starts with scope (e.g. "stock:"). */
  list(scope = '') {
    const store = storage();
    if (!store) return [];
    const result = [];
    try {
      for (let index = 0; index < store.length; index += 1) {
        const name = store.key(index);
        if (!name?.startsWith(PREFIX + scope)) continue;
        let details = {};
        try {
          details = JSON.parse(store.getItem(name)) ?? {};
        } catch {
          /* unreadable details: keep the key only */
        }
        result.push({ ...details, key: name.slice(PREFIX.length) });
      }
    } catch {
      return [];
    }
    return result.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  },
};
