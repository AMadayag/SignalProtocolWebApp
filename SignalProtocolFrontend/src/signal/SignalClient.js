/**
 * Electron version: a thin proxy to the main process, which does all the
 * real crypto with the official @signalapp/libsignal-client (see
 * src/main/signal/signalManager.js in the Electron project). No WASM here
 * at all — this file exists only so App.jsx/Register.jsx/Login.jsx don't
 * need to change from the browser version.
 */
export class SignalSession {
  constructor(username, deviceId) {
    this.username = username;
    this.deviceId = deviceId;
    this.authToken = null;
  }

  async initOrRestore(jwtToken) {
    const { authToken } = await window.signalAPI.initOrRestore(this.username, this.deviceId, jwtToken);
    this.authToken = authToken;
  }

  async topUpPreKeys() {
    return window.signalAPI.topUpPreKeys();
  }
}
