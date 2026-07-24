/**
 * Persists which account/device is "logged in" across page reloads.
 *
 * Only the JWT and username/deviceId live here — no private key material.
 * The actual Signal identity/session state stays in IndexedDB
 * (see signal/persistence.js); this just remembers *which* identity to
 * restore on next load.
 */

const STORAGE_KEY = 'signal_login_state';

export function saveLoginState({ jwtToken, username, deviceId }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ jwtToken, username, deviceId }));
}

export function loadLoginState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearLoginState() {
  localStorage.removeItem(STORAGE_KEY);
}
