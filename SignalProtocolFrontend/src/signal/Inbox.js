/**
 * Electron version: a thin proxy to the main process's WebSocket + crypto
 * handling. Same external API as the browser version (connectInbox,
 * disconnectInbox, subscribe, sendMessageTo, getHistory) — Chat.jsx and
 * Home.jsx don't need to know anything changed underneath.
 */
const listeners = new Map(); // "peerName:peerDeviceId" -> Set<callback>
let mainProcessUnsubscribe = null;
let decryptErrorUnsubscribe = null;

function peerKey(peerName, peerDeviceId) {
  return `${peerName}:${peerDeviceId}`;
}

export function connectInbox(_session) {
  console.log(`[inbox] connectInbox called, mainProcessUnsubscribe already set: ${!!mainProcessUnsubscribe}`);
  window.signalAPI.connect();

  if (!mainProcessUnsubscribe) {
    mainProcessUnsubscribe = window.signalAPI.onMessage(({ peerName, peerDeviceId, message }) => {
      const key = peerKey(peerName, peerDeviceId);
      const found = listeners.get(key);
      console.log(`[inbox] notify for ${key}: ${found ? found.size : 0} listener(s) registered`);
      found?.forEach((cb) => cb(message));
    });
  }

  if (!decryptErrorUnsubscribe) {
    decryptErrorUnsubscribe = window.signalAPI.onDecryptError(({ peerName, peerDeviceId, error }) => {
      // Loud on purpose — a failed decrypt previously vanished with no
      // trace, looking identical to "the live update just didn't arrive".
      console.error(`[inbox] FAILED TO DECRYPT a message from ${peerName}.${peerDeviceId}:`, error);
    });
  }
}

export function disconnectInbox() {
  window.signalAPI.disconnect();
  mainProcessUnsubscribe?.();
  mainProcessUnsubscribe = null;
  decryptErrorUnsubscribe?.();
  decryptErrorUnsubscribe = null;
}

export function subscribe(peerName, peerDeviceId, callback) {
  const key = peerKey(peerName, peerDeviceId);
  console.log(`[inbox] subscribing to ${key}`);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => {
    console.log(`[inbox] unsubscribing from ${key}`);
    listeners.get(key)?.delete(callback);
  };
}

export async function sendMessageTo(peerName, peerDeviceId, text) {
  const message = await window.signalAPI.sendMessage(peerName, peerDeviceId, text);
  listeners.get(peerKey(peerName, peerDeviceId))?.forEach((cb) => cb(message));
  return message;
}

export async function getHistory(peerName, peerDeviceId) {
  return window.signalAPI.getHistory(peerName, peerDeviceId);
}
