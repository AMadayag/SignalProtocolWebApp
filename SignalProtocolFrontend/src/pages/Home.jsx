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

  useEffect(() => {
    const session = window.__signalSession;
    if (!session) {
      setLoggedOut(true);
      setLoading(false);
      return;
    }

    fetchConversations(session.username, session.deviceId, session.authToken)
      .then((list) => setConversations(list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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

  if (loading) return <div>Loading chats...</div>;

  if (loggedOut) {
    return (
      <div>
        <p>You're not logged in.</p>
        <button onClick={() => navigate('/register')}>Sign Up</button>
        <button onClick={() => navigate('/login')}>Log In</button>
      </div>
    );
  }

  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Chats</h2>
        <div>
          <button onClick={() => setShowNewChat((v) => !v)}>
            {showNewChat ? 'Cancel' : 'New Chat'}
          </button>
          <button onClick={handleLogout}>Log Out</button>
        </div>
      </div>

      {showNewChat && (
        <div style={{ margin: '1em 0' }}>
          <input
            placeholder="username"
            value={newChatUsername}
            onChange={(e) => setNewChatUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStartChat()}
          />
          <button onClick={handleStartChat} disabled={checking}>
            {checking ? 'Checking...' : 'Start'}
          </button>
          {newChatError && <p style={{ color: 'red' }}>{newChatError}</p>}
        </div>
      )}

      {conversations.length === 0 ? (
        <p>No chats yet. Start one above.</p>
      ) : (
        <ul>
          {conversations.map((c) => (
            <li key={`${c.username}:${c.deviceId}`}>
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
