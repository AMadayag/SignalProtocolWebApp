import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignalSession } from "../signal/signalClient.js";
import { connectInbox } from "../signal/Inbox.js";
import { saveLoginState } from "../auth/Session.js";

/**
 * NOTE: this assumes the SAME BROWSER that originally registered this
 * account/device — the private keys live in this browser's IndexedDB, and
 * there's no way to log in from a different browser/machine without them
 * (consistent with "single device only" noted elsewhere in this project).
 * Logging in from a browser that's never registered this account will hit
 * the registration path instead of restore, and fail with a 409 since
 * deviceId 1 is already taken on the server.
 */
function Login() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const { username, password } = formData;
    const deviceId = 1;

    setStatus('Logging in...');

    const loginRes = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!loginRes.ok) {
      setStatus(`Login failed: ${await loginRes.text()}`);
      return;
    }
    const { token: jwtToken } = await loginRes.json();

    setStatus('Restoring your keys...');
    const session = new SignalSession(username, deviceId);
    await session.initOrRestore(jwtToken);

    window.__jwtToken = jwtToken;
    window.__signalSession = session;
    connectInbox(session);
    saveLoginState({ jwtToken, username, deviceId });

    navigate('/');
  };

  return (
    <>
      <div>Log In</div>
      <form onSubmit={(e) => e.preventDefault()}>
        <div>username</div>
        <input name="username" value={formData.username} onChange={handleChange}></input>
        <div>password</div>
        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
        ></input>
        <button onClick={handleSubmit}>Submit</button>
      </form>
      <button onClick={() => navigate('/register')}>Sign Up</button>
      {status && <p>{status}</p>}
    </>
  );
}

export default Login;
