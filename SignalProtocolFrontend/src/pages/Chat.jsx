import { useEffect, useRef, useState } from "react";
import { connectMessageSocket } from "../signal/serverApi.js";

/**
 * Minimal chat UI. Assumes `window.__signalSession` was set by Register.jsx
 * (or your real login flow) — a SignalSession that's already called
 * initOrRestore(). In a real app, pass this via context instead of window.
 */
function Chat({ peerName, peerDeviceId = 1 }) {
  const [messages, setMessages] = useState([]); // { from, text }
  const [draft, setDraft] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    const session = window.__signalSession;
    if (!session) return;

    const socket = connectMessageSocket(
      session.username,
      session.deviceId,
      session.authToken,
      async (envelope) => {
        // Decrypt happens here, in the browser, right as the envelope arrives.
        const text = await session.decryptEnvelope(envelope);
        setMessages((prev) => [...prev, { from: envelope.from, text }]);
      }
    );
    socketRef.current = socket;

    return () => socket.close();
  }, []);

  const handleSend = async () => {
    const session = window.__signalSession;
    if (!session || !draft.trim()) return;

    // Encrypt happens here, in the browser, before anything is sent.
    const { ciphertextType, ciphertextBase64 } = await session.encryptFor(
      peerName,
      peerDeviceId,
      draft
    );

    socketRef.current.send(peerName, peerDeviceId, ciphertextType, ciphertextBase64);
    setMessages((prev) => [...prev, { from: session.username, text: draft }]);
    setDraft('');
  };

  return (
    <div>
      <div>Chat with {peerName}</div>
      <ul>
        {messages.map((m, i) => (
          <li key={i}><strong>{m.from}:</strong> {m.text}</li>
        ))}
      </ul>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}

export default Chat;
