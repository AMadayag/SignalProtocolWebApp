/**
 * All the HTTP/WebSocket calls to your Express server. This file has no
 * crypto in it at all — it just moves JSON and opens a socket, matching
 * what `signal-server`'s routes expect.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000';

export async function registerDevice(payload) {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Register failed: ${res.status} ${await res.text()}`);
  }
  return res.json(); // { authToken }
}

export async function fetchPreKeyBundle(username, deviceId) {
  const res = await fetch(`${API_URL}/users/${username}/${deviceId}/bundle`);
  if (!res.ok) {
    throw new Error(`Bundle fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function topUpPreKeys(username, deviceId, authToken, body) {
  const res = await fetch(`${API_URL}/users/${username}/${deviceId}/prekeys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Top-up failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Opens the live message channel. `onEnvelope` fires for every incoming
 * message (both ones flushed from the queue on connect, and ones pushed
 * live). Returns an object with `send` and `close`.
 */
export function connectMessageSocket(username, deviceId, authToken, onEnvelope) {
  const url = `${WS_URL}?name=${encodeURIComponent(username)}&deviceId=${deviceId}&token=${encodeURIComponent(authToken)}`;
  const ws = new WebSocket(url);

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'message') {
      onEnvelope(msg.envelope);
    } else if (msg.type === 'error') {
      console.error('Server reported an error:', msg.message);
    }
    // msg.type === 'ack' is available if you want to confirm delivery of
    // your own sent messages; not required for basic operation.
  });

  return {
    raw: ws,
    send(to, toDeviceId, ciphertextType, ciphertextBase64) {
      ws.send(
        JSON.stringify({
          type: 'send',
          to,
          toDeviceId,
          ciphertextType,
          ciphertext: ciphertextBase64,
        })
      );
    },
    close() {
      ws.close();
    },
  };
}
