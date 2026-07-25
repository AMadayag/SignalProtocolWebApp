import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignalSession } from "../signal/signalClient.js";
import { connectInbox } from "../signal/Inbox.js";
import { saveLoginState } from "../auth/Session.js";
import { login } from "../signal/ServerApi.js";

/**
 * NOTE: this assumes the SAME MACHINE that originally registered this
 * account/device — private keys live in Electron's local main-process
 * storage on that machine, and there's no way to log in from a different
 * machine without them (consistent with "single device only" noted
 * elsewhere in this project). Logging in from a machine that's never
 * registered this account will hit the registration path instead of
 * restore, and fail with a 409 since deviceId 1 is already taken on the server.
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
 
    let jwtToken;
    try {
      const result = await login(username, password);
      jwtToken = result.token;
    } catch (err) {
      setStatus(err.message);
      return;
    }
 
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
    <div className="page">
      <div className="card">
        <h2>Log in</h2>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" name="username" value={formData.username} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
            />
          </div>
          <button onClick={handleSubmit}>Log in</button>
        </form>
        {status && <p className="muted">{status}</p>}
        <button className="swap-pages-button" onClick={() => navigate('/register')}>Sign up</button>
      </div>
    </div>
  );
}
 
export default Login;
