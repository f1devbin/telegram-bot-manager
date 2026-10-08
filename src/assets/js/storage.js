// Safe wrappers: storage may be unavailable (private mode, blocked site data).
const PREFIX = 'tbm.';

function store(kind) {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function get(key, kind = 'local') {
  try {
    return store(kind)?.getItem(PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export function set(key, value, kind = 'local') {
  try {
    store(kind)?.setItem(PREFIX + key, value);
  } catch { /* ignore */ }
}

export function remove(key, kind = 'local') {
  try {
    store(kind)?.removeItem(PREFIX + key);
  } catch { /* ignore */ }
}

// Token lives in sessionStorage (this tab only) unless the user asked to remember it.
export function saveToken(token, remember) {
  clearToken();
  set('token', token, remember ? 'local' : 'session');
}

export function loadToken() {
  const session = get('token', 'session');
  if (session) return { token: session, remember: false };
  const local = get('token', 'local');
  return local ? { token: local, remember: true } : null;
}

export function clearToken() {
  remove('token', 'local');
  remove('token', 'session');
}
