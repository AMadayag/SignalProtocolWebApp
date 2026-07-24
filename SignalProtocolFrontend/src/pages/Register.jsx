import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { connectInbox } from "../signal/Inbox.js";
import { saveLoginState } from "../auth/Session.js";
import { SignalSession } from "../signal/signalClient.js";

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
    const signupRes = await fetch('http://localhost:3000/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!signupRes.ok) {
      setStatus(`Signup failed: ${await signupRes.text()}`);
      return;
    }
    const { token: jwtToken } = await signupRes.json();

    // Step 2: generate this device's Signal keys IN THE BROWSER and register
    // them. Private keys never leave this tab — only public keys are sent
    // in the registerDevice() call inside initOrRestore(). jwtToken proves
    // to the server which account this device belongs to.
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
