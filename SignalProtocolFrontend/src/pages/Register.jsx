import { useState } from "react";
import { SignalSession } from "../signal/signalClient.js";

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [status, setStatus] = useState('');

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

    // Step 2: generate this device's Signal keys IN THE BROWSER and register
    // them. Private keys never leave this tab — only public keys are sent
    // in the registerDevice() call inside initOrRestore().
    setStatus('Generating encryption keys...');
    const session = new SignalSession(username, deviceId);
    await session.initOrRestore();

    // Stash the session on window for this demo so other components/pages
    // can reuse it without regenerating. In a real app, put this in your
    // auth/context state instead.
    window.__signalSession = session;

    setStatus('Registered! Keys generated locally and never left your browser.');
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
