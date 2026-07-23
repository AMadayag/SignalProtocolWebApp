import { API_URL } from "./api";

export async function completeRegister(username, password) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    console.error('Signup failed:', await res.text());
    return;
  }

  const data = await res.json();
  console.log('Signed up:', data);

  // register device's signal keys
};


export async function fetchPreKeyBundle(name, deviceId) {
  const res = await fetch(`${API_URL}/users/${name}/${deviceId}/bundle`);
  if (!res.ok) {
    throw new Error(`Bundle fetch failed: ${res.status}`);
  }
  return res.json();
}