/**
 * Electron version: a thin proxy to the main process's WebSocket + crypto
 * handling. Same external API as the browser version (connectInbox,
 * disconnectInbox, subscribe, sendMessageTo, getHistory) — Chat.jsx and
 * Home.jsx don't need to know anything changed underneath.
 */
const listeners = new Map(); // "peerName:peerDeviceId" -> Set<callback>
let mainProcessUnsubscribe = null;

function peerKey(peerName, peerDeviceId) {
  return `${peerName}:${peerDeviceId}`;
}

export function connectInbox(_session) {
  window.signalAPI.connect();

  if (!mainProcessUnsubscribe) {
    mainProcessUnsubscribe = window.signalAPI.onMessage(({ peerName, peerDeviceId, message }) => {
      listeners.get(peerKey(peerName, peerDeviceId))?.forEach((cb) => cb(message));
    });
  }
}

export function disconnectInbox() {
  window.signalAPI.disconnect();
  mainProcessUnsubscribe?.();
  mainProcessUnsubscribe = null;
}

export function subscribe(peerName, peerDeviceId, callback) {
  const key = peerKey(peerName, peerDeviceId);
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback);
}

export async function sendMessageTo(peerName, peerDeviceId, text) {
  const message = await window.signalAPI.sendMessage(peerName, peerDeviceId, text);
  listeners.get(peerKey(peerName, peerDeviceId))?.forEach((cb) => cb(message));
  return message;
}

export async function getHistory(peerName, peerDeviceId) {
  return window.signalAPI.getHistory(peerName, peerDeviceId);
}
