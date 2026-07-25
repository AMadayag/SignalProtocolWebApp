import { useEffect, useState } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Chat from './pages/Chat.jsx';
import { SignalSession } from './signal/signalClient.js';
import { connectInbox } from './signal/Inbox.js';
import { loadLoginState, clearLoginState } from './auth/Session.js';
import './Styles.css'

function ChatRoute() {
  const { peerUsername, peerDeviceId } = useParams();
  return <Chat peerName={peerUsername} peerDeviceId={Number(peerDeviceId)} />;
}

function App() {
  const [restoring, setRestoring] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function restore() {
      const saved = loadLoginState();
      if (!saved) {
        setRestoring(false);
        return;
      }

      try {
        // Private keys/sessions are already in IndexedDB from before — this
        // takes the "restore" path inside initOrRestore(), not regeneration.
        // jwtToken is passed along in case it's somehow needed, but
        // shouldn't be for an already-registered device.
        const session = new SignalSession(saved.username, saved.deviceId);
        await session.initOrRestore(saved.jwtToken);
        window.__signalSession = session;
        window.__jwtToken = saved.jwtToken;
        connectInbox(session);
      } catch (err) {
        console.error('Failed to restore session:', err);
        clearLoginState();
        navigate('/register');
      } finally {
        setRestoring(false);
      }
    }

    restore();
  }, []);

  if (restoring) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/chat/:peerUsername/:peerDeviceId" element={<ChatRoute />} />
    </Routes>
  );
}

export default App;
