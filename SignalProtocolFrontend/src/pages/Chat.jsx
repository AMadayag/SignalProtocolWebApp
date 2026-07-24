import { useEffect, useState } from "react";
import { subscribe, sendMessageTo, getHistory } from "../signal/inbox.js";

/**
 * Assumes connectInbox(session) was already called (see App.jsx, right
 * after login/restore) — this component just reads/writes through it.
 * Doesn't own a WebSocket itself; see signal/inbox.js for why.
 */
function Chat({ peerName, peerDeviceId = 1 }) {
  const [messages, setMessages] = useState([]); // { from, text, sentAt }
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let active = true;

    const refresh = () => {
      getHistory(peerName, peerDeviceId).then((history) => {
        if (active) setMessages(history);
      });
    };

    refresh();

    // Deliberately re-fetch the full history on every notification instead
    // of trusting/appending the individual pushed message. This was found
    // to occasionally miss a live push (message still saved correctly —
    // just not shown until the chat was reopened); re-reading from the
    // same persisted source of truth "reopen" already uses makes a missed
    // push self-correct the moment any subsequent event fires, rather than
    // depending on every single push landing perfectly.
    const unsubscribe = subscribe(peerName, peerDeviceId, refresh);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [peerName, peerDeviceId]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    const text = draft;
    setDraft('');
    await sendMessageTo(peerName, peerDeviceId, text);
    // No manual setMessages call needed here — sendMessageTo() notifies
    // the same subscription this component is already listening on, which
    // now triggers a refresh() rather than an optimistic append.
  };

  return (
    <div>
      <div>Chat with {peerName}</div>
      <ul>
        {messages.map((m, i) => (
          <li key={i}><strong>{m.from}:</strong> {m.text}</li>
        ))}
      </ul>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}

export default Chat;
