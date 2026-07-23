/**
 * Persists key material and session state in IndexedDB so a page refresh
 * doesn't lose your identity or force re-establishing every session.
 *
 * Everything stored here is Signal-protocol byte blobs (protobuf records,
 * some of which contain private keys). This is fine for "keys never leave
 * the device," but it's still plaintext-at-rest in IndexedDB — anyone with
 * local access to the browser profile (or malicious extension) could read
 * it. If that threat model matters for you, encrypt these blobs with a
 * key derived from a user password before storing (e.g. via WebCrypto's
 * PBKDF2 + AES-GCM) rather than storing them raw as done here.
 */
import { get, set, del } from 'idb-keyval';
import { toBase64, fromBase64 } from './Base64';

const IDENTITY_KEY = (username, deviceId) => `identity:${username}:${deviceId}`;
const PREKEY_IDS_KEY = (username, deviceId) => `prekey-ids:${username}:${deviceId}`;
const SIGNED_PREKEY_ID_KEY = (username, deviceId) => `signed-prekey-id:${username}:${deviceId}`;
const KYBER_PREKEY_ID_KEY = (username, deviceId) => `kyber-prekey-id:${username}:${deviceId}`;
const PREKEY_RECORD_KEY = (username, deviceId, id) => `prekey-record:${username}:${deviceId}:${id}`;
const SIGNED_PREKEY_RECORD_KEY = (username, deviceId, id) => `signed-prekey-record:${username}:${deviceId}:${id}`;
const KYBER_PREKEY_RECORD_KEY = (username, deviceId, id) => `kyber-prekey-record:${username}:${deviceId}:${id}`;
const SESSION_KEY = (username, deviceId, peerName, peerDeviceId) =>
  `session:${username}:${deviceId}:${peerName}:${peerDeviceId}`;
const AUTH_TOKEN_KEY = (username, deviceId) => `auth-token:${username}:${deviceId}`;

// --- Identity (contains the private key — this is the crown jewel) ---

export async function saveIdentity(username, deviceId, { identityKeyPairBytes, registrationId }) {
  await set(IDENTITY_KEY(username, deviceId), {
    identityKeyPair: toBase64(identityKeyPairBytes),
    registrationId,
  });
}

export async function loadIdentity(username, deviceId) {
  const record = await get(IDENTITY_KEY(username, deviceId));
  if (!record) return null;
  return {
    identityKeyPairBytes: fromBase64(record.identityKeyPair),
    registrationId: record.registrationId,
  };
}

// --- Auth token ---

export async function saveAuthToken(username, deviceId, token) {
  await set(AUTH_TOKEN_KEY(username, deviceId), token);
}

export async function loadAuthToken(username, deviceId) {
  return (await get(AUTH_TOKEN_KEY(username, deviceId))) ?? null;
}

// --- Prekey records (each holds a private key; keyed by protocol key id) ---

export async function savePreKeyRecord(username, deviceId, keyId, recordBytes) {
  const ids = (await get(PREKEY_IDS_KEY(username, deviceId))) ?? [];
  if (!ids.includes(keyId)) {
    await set(PREKEY_IDS_KEY(username, deviceId), [...ids, keyId]);
  }
  await set(PREKEY_RECORD_KEY(username, deviceId, keyId), toBase64(recordBytes));
}

export async function loadAllPreKeyRecords(username, deviceId) {
  const ids = (await get(PREKEY_IDS_KEY(username, deviceId))) ?? [];
  const out = [];
  for (const id of ids) {
    const b64 = await get(PREKEY_RECORD_KEY(username, deviceId, id));
    if (b64) out.push({ id, recordBytes: fromBase64(b64) });
  }
  return out;
}

export async function saveSignedPreKeyRecord(username, deviceId, keyId, recordBytes) {
  await set(SIGNED_PREKEY_ID_KEY(username, deviceId), keyId);
  await set(SIGNED_PREKEY_RECORD_KEY(username, deviceId, keyId), toBase64(recordBytes));
}

export async function loadSignedPreKeyRecord(username, deviceId) {
  const keyId = await get(SIGNED_PREKEY_ID_KEY(username, deviceId));
  if (keyId === undefined) return null;
  const b64 = await get(SIGNED_PREKEY_RECORD_KEY(username, deviceId, keyId));
  if (!b64) return null;
  return { id: keyId, recordBytes: fromBase64(b64) };
}

export async function saveKyberPreKeyRecord(username, deviceId, keyId, recordBytes) {
  await set(KYBER_PREKEY_ID_KEY(username, deviceId), keyId);
  await set(KYBER_PREKEY_RECORD_KEY(username, deviceId, keyId), toBase64(recordBytes));
}

export async function loadKyberPreKeyRecord(username, deviceId) {
  const keyId = await get(KYBER_PREKEY_ID_KEY(username, deviceId));
  if (keyId === undefined) return null;
  const b64 = await get(KYBER_PREKEY_RECORD_KEY(username, deviceId, keyId));
  if (!b64) return null;
  return { id: keyId, recordBytes: fromBase64(b64) };
}

// --- Sessions (one per peer device you've talked to) ---

export async function saveSession(username, deviceId, peerName, peerDeviceId, sessionBytes) {
  await set(SESSION_KEY(username, deviceId, peerName, peerDeviceId), toBase64(sessionBytes));
}

export async function loadSession(username, deviceId, peerName, peerDeviceId) {
  const b64 = await get(SESSION_KEY(username, deviceId, peerName, peerDeviceId));
  return b64 ? fromBase64(b64) : null;
}

export async function clearAllLocalData(username, deviceId) {
  await del(IDENTITY_KEY(username, deviceId));
  await del(AUTH_TOKEN_KEY(username, deviceId));
  // Note: doesn't sweep prekey/session keys since those are dynamically
  // enumerated; fine for a dev reset, but a real "log out and wipe" flow
  // should track and delete all keys it created.
}
