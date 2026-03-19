const SESSION_KEY = 'edukreasi-license-admin-secret-session';
const PERSIST_KEY = 'edukreasi-license-admin-secret-persist';

function readStorage(storage, key) {
  try {
    return String(storage.getItem(key) || '').trim();
  } catch {
    return '';
  }
}

function writeStorage(storage, key, value) {
  try {
    if (value) {
      storage.setItem(key, value);
    } else {
      storage.removeItem(key);
    }
  } catch {
    // Ignore storage errors in restricted browsers.
  }
}

function getAdminSecret() {
  return readStorage(window.sessionStorage, SESSION_KEY) || readStorage(window.localStorage, PERSIST_KEY);
}

function setAdminSecret(secret, remember = false) {
  const value = String(secret || '').trim();
  if (!value) return;

  if (remember) {
    writeStorage(window.localStorage, PERSIST_KEY, value);
    writeStorage(window.sessionStorage, SESSION_KEY, '');
    return;
  }

  writeStorage(window.sessionStorage, SESSION_KEY, value);
  writeStorage(window.localStorage, PERSIST_KEY, '');
}

function clearAdminSecret() {
  writeStorage(window.sessionStorage, SESSION_KEY, '');
  writeStorage(window.localStorage, PERSIST_KEY, '');
}

function buildAdminHeaders(secret = getAdminSecret(), headers = {}) {
  const resolvedSecret = String(secret || '').trim();
  if (!resolvedSecret) return { ...headers };
  return {
    ...headers,
    'x-admin-secret': resolvedSecret
  };
}

export {
  buildAdminHeaders,
  clearAdminSecret,
  getAdminSecret,
  setAdminSecret
};
