import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchConversations, checkUserExists } from "../signal/ServerApi.js";
import { clearLoginState } from "../auth/Session.js";
import { disconnectInbox } from "../signal/Inbox.js";

/**
 * Assumes `window.__signalSession` was set during Register/login — a
 * SignalSession that's already called initOrRestore(). In a real app, pull
 * this from context instead of window (same note as Chat.jsx).
 */
function Home() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggedOut, setLoggedOut] = useState(false);

  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState('');
  const [newChatError, setNewChatError] = useState('');
  const [checking, setChecking] = useState(false);

  const navigate = useNavigate();

  const loadConversations = () => {
    const session = window.__signalSession;
    if (!session) {
      setLoggedOut(true);
      setLoading(false);
      return;
    }

    setError('');
    fetchConversations(session.username, session.deviceId, session.authToken)
      .then((list) => setConversations(list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const handleStartChat = async () => {
    const username = newChatUsername.trim();
    if (!username) return;

    const session = window.__signalSession;
    if (username === session?.username) {
      setNewChatError("That's you — pick someone else to chat with.");
      return;
    }

    setChecking(true);
    setNewChatError('');
    try {
      const user = await checkUserExists(username);
      if (!user) {
        setNewChatError(`No account found for "${username}".`);
        return;
      }
      if (user.deviceIds.length === 0) {
        setNewChatError(`"${username}" hasn't registered a device yet.`);
        return;
      }
      // Single-device assumption throughout this project so far — use their first device.
      navigate(`/chat/${encodeURIComponent(username)}/${user.deviceIds[0]}`);
    } catch (err) {
      setNewChatError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    // Only clears the "who's logged in" pointer — private keys/sessions
    // stay in IndexedDB, so logging back in as the same account on this
    // same browser will still work (see Login.jsx's restore path).
    clearLoginState();
    disconnectInbox();
    delete window.__signalSession;
    delete window.__jwtToken;
    navigate('/login');
  };

  if (loading) return <div className="page"><p className="muted">Loading chats...</p></div>;

  if (loggedOut) {
    return (
      <div className="page">
        <div className="card">
          <p>You're not logged in.</p>
          <div className="button-row">
            <button onClick={() => navigate('/register')}>Sign up</button>
            <button className="secondary" onClick={() => navigate('/login')}>Log in</button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <p className="error-text">Error: {error}</p>
          <p className="muted">This account's local session may be out of sync with the server (e.g. after a database reset or switching servers).</p>
          <button className="secondary" onClick={handleLogout}>Log out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wide">
      <div className="header-row">
        <h2>Chats</h2>
        <div className="button-row">
          <button className="secondary" onClick={loadConversations}>Refresh</button>
          <button className="secondary" onClick={() => setShowNewChat((v) => !v)}>
            {showNewChat ? 'Cancel' : 'New chat'}
          </button>
          <button className="danger" onClick={handleLogout}>Log out</button>
        </div>
      </div>

      {showNewChat && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="field">
            <input
              placeholder="Username"
              value={newChatUsername}
              onChange={(e) => setNewChatUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartChat()}
            />
          </div>
          <button onClick={handleStartChat} disabled={checking}>
            {checking ? 'Checking...' : 'Start'}
          </button>
          {newChatError && <p className="error-text">{newChatError}</p>}
        </div>
      )}

      {conversations.length === 0 ? (
        <p className="muted">No chats yet. Start one above.</p>
      ) : (
        <ul className="conversation-list">
          {conversations.map((c) => (
            <li key={`${c.username}:${c.deviceId}`} className="conversation-item">
              <button onClick={() => navigate(`/chat/${encodeURIComponent(c.username)}/${c.deviceId}`)}>
                {c.username}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Home;
