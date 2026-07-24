/**
 * Electron version. Auth (signup/login) still goes straight from the
 * renderer to the Express server — no private key material is involved,
 * so there's no benefit to routing it through main. Directory lookups and
 * anything crypto-adjacent go through window.signalAPI (IPC to main)
 * instead, keeping the same function signatures as the browser version so
 * Home.jsx doesn't need to change.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function signup(username, password) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Signup failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function login(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** username/deviceId/authToken params are accepted for signature compatibility with the browser version but ignored — main process already knows the active session. */
export async function fetchConversations(_username, _deviceId, _authToken) {
  return window.signalAPI.fetchConversations();
}

export async function checkUserExists(username) {
  return window.signalAPI.checkUserExists(username);
}
