import { useEffect, useState } from "react";
import { subscribe, sendMessageTo, getHistory } from "../signal/Inbox.js";
import { useNavigate } from "react-router-dom";

/**
 * Assumes connectInbox(session) was already called (see App.jsx, right
 * after login/restore) — this component just reads/writes through it.
 * Doesn't own a WebSocket itself; see signal/inbox.js for why.
 */
function Chat({ peerName, peerDeviceId = 1 }) {
  const [messages, setMessages] = useState([]); // { from, text, sentAt }
  const [draft, setDraft] = useState('');
  const navigate = useNavigate();

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
    <div className="chat-page">
      <div className="chat-header">
        <div>Chat with {peerName}</div>
        <button onClick={() => navigate('/')}>Home</button>
      </div>
      <ul className="message-list">
        {messages.map((m, i) => {
          const isSelf = m.from === window.__signalSession?.username;
          return (
            <li key={i} className={`message-bubble ${isSelf ? 'self' : 'other'}`}>
              {!isSelf && <span className="sender">{m.from}</span>}
              {m.text}
            </li>
          );
        })}
      </ul>
      <div className="chat-input-row">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

export default Chat;
