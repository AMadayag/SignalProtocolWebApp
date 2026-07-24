import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignalSession } from "../signal/signalClient.js";
import { connectInbox } from "../signal/Inbox.js";
import { saveLoginState } from "../auth/Session.js";
import { signup } from "../signal/ServerApi.js";

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const { username, password } = formData;
    const deviceId = 1; // single-device for now, see earlier discussion

    setStatus('Creating account...');

    // Step 1: create the account (username/password) via your existing auth route.
    let jwtToken;
    try {
      const result = await signup(username, password);
      jwtToken = result.token;
    } catch (err) {
      setStatus(err.message);
      return;
    }

    // Step 2: generate this device's Signal keys — real libsignal, running
    // in Electron's main process (see signal-electron), not in the browser.
    // Private keys never leave this device; only public keys are sent in
    // the registerDevice() call inside initOrRestore().
    setStatus('Generating encryption keys...');
    const session = new SignalSession(username, deviceId);
    await session.initOrRestore(jwtToken);

    window.__jwtToken = jwtToken;
    window.__signalSession = session;
    connectInbox(session);

    // Persist so a page reload doesn't lose the login — App.jsx reads this
    // on startup and restores the session from IndexedDB automatically.
    saveLoginState({ jwtToken, username, deviceId });

    setStatus('Registered! Keys generated locally and never left your browser.');
    navigate('/');
  };

  return (
    <>
      <div>Register</div>
      <form onSubmit={(e) => e.preventDefault()}>
        <div>username</div>
        <input name="username" value={formData.username} onChange={handleChange}></input>
        <div>password</div>
        <input name="password" value={formData.password} onChange={handleChange}></input>
        <button onClick={handleSubmit}>Submit</button>
      </form>
      {status && <p>{status}</p>}
    </>
  )
}

export default Register
