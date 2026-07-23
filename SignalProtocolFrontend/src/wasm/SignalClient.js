/**
 * Wraps @getmaapp/signal-wasm (v0.4.0 API, verified against its actual
 * shipped .d.ts — the GitHub README documents an older `SignalClient` class
 * that this version does NOT have; don't follow it).
 *
 * All private key material lives only in this module's in-memory store
 * objects and in IndexedDB (via persistence.js). It never gets sent
 * anywhere — only public keys and ciphertext ever go to the server.
 */
import init, {
  WasmProtocolAddress,
  WasmPrivateKey,
  WasmPublicKey,
  WasmIdentityKeyPair,
  WasmInMemIdentityKeyStore,
  WasmInMemPreKeyStore,
  WasmInMemSignedPreKeyStore,
  WasmInMemKyberPreKeyStore,
  WasmInMemSessionStore,
  generateRegistrationId,
  generatePreKeys,
  generateSignedPreKey,
  generateKyberPreKey,
  processPreKeyBundle,
  encryptMessage as wasmEncryptMessage,
  decryptMessage as wasmDecryptMessage,
} from '@getmaapp/signal-wasm';

import { toBase64 } from './Base64.js';
import * as store from './Persistence.js';
import { registerDevice, fetchPreKeyBundle } from './ServerApi.js';

let wasmReady = false;
async function ensureWasm() {
  if (!wasmReady) {
    await init();
    wasmReady = true;
  }
}

/**
 * One instance per (username, deviceId) — holds the live WASM store objects
 * for the duration of the session. These are NOT persisted directly; the
 * underlying records are exported to IndexedDB as they're created/used.
 */
export class SignalSession {
  constructor(username, deviceId) {
    this.username = username;
    this.deviceId = deviceId;
    this.address = null; // set once WASM is ready
    this.identityStore = null;
    this.preKeyStore = null;
    this.signedPreKeyStore = null;
    this.kyberPreKeyStore = null;
    this.sessionStore = null;
    this.identityKeyPair = null;
    this.registrationId = null;
    this.authToken = null;
  }

  /**
   * Either loads an existing identity from IndexedDB, or generates a brand
   * new one (first run) and registers it with the server. Call this once
   * on app startup / login.
   */
  async initOrRestore() {
    await ensureWasm();
    this.address = new WasmProtocolAddress(this.username, this.deviceId);
    this.preKeyStore = new WasmInMemPreKeyStore();
    this.signedPreKeyStore = new WasmInMemSignedPreKeyStore();
    this.kyberPreKeyStore = new WasmInMemKyberPreKeyStore();
    this.sessionStore = new WasmInMemSessionStore();

    const existing = await store.loadIdentity(this.username, this.deviceId);

    if (existing) {
      await this._restore(existing);
    } else {
      await this._generateAndRegister();
    }

    this.authToken = await store.loadAuthToken(this.username, this.deviceId);
  }

  async _restore({ identityKeyPairBytes, registrationId }) {
    this.identityKeyPair = WasmIdentityKeyPair.deserialize(identityKeyPairBytes);
    this.registrationId = registrationId;
    this.identityStore = new WasmInMemIdentityKeyStore(this.identityKeyPair, registrationId);

    const preKeyRecords = await store.loadAllPreKeyRecords(this.username, this.deviceId);
    for (const { id, recordBytes } of preKeyRecords) {
      await this.preKeyStore.import_pre_key(id, recordBytes);
    }

    const signedPreKey = await store.loadSignedPreKeyRecord(this.username, this.deviceId);
    if (signedPreKey) {
      await this.signedPreKeyStore.import_signed_pre_key(signedPreKey.id, signedPreKey.recordBytes);
    }

    const kyberPreKey = await store.loadKyberPreKeyRecord(this.username, this.deviceId);
    if (kyberPreKey) {
      await this.kyberPreKeyStore.import_kyber_pre_key(kyberPreKey.id, kyberPreKey.recordBytes);
    }
    // Sessions with specific peers are restored lazily in ensureSessionWith(),
    // since we don't know in advance which peers this device has talked to.
  }

  async _generateAndRegister() {
    const privateKey = WasmPrivateKey.generate();
    const publicKey = privateKey.getPublicKey();
    this.identityKeyPair = new WasmIdentityKeyPair(publicKey, privateKey);
    this.registrationId = generateRegistrationId();
    this.identityStore = new WasmInMemIdentityKeyStore(this.identityKeyPair, this.registrationId);

    await store.saveIdentity(this.username, this.deviceId, {
      identityKeyPairBytes: this.identityKeyPair.serialize(),
      registrationId: this.registrationId,
    });

    const oneTimePreKeys = await generatePreKeys(1, 10, this.preKeyStore);
    for (const pk of oneTimePreKeys) {
      await store.savePreKeyRecord(this.username, this.deviceId, pk.id, pk.record);
    }

    const signedPreKey = await generateSignedPreKey(1, this.identityKeyPair, this.signedPreKeyStore);
    await store.saveSignedPreKeyRecord(this.username, this.deviceId, signedPreKey.id, signedPreKey.record);

    const kyberPreKey = await generateKyberPreKey(1, this.identityKeyPair, this.kyberPreKeyStore);
    await store.saveKyberPreKeyRecord(this.username, this.deviceId, kyberPreKey.id, kyberPreKey.record);

    const { authToken } = await registerDevice({
      username: this.username,
      deviceId: this.deviceId,
      registrationId: this.registrationId,
      identityKey: toBase64(this.identityKeyPair.public_key.serialize()),
      signedPreKey: {
        id: signedPreKey.id,
        publicKey: toBase64(signedPreKey.public_key),
        signature: toBase64(signedPreKey.signature),
      },
      kyberPreKey: {
        id: kyberPreKey.id,
        publicKey: toBase64(kyberPreKey.public_key),
        signature: toBase64(kyberPreKey.signature),
      },
      oneTimePreKeys: oneTimePreKeys.map((pk) => ({
        id: pk.id,
        publicKey: toBase64(pk.public_key),
      })),
    });

    this.authToken = authToken;
    await store.saveAuthToken(this.username, this.deviceId, authToken);
  }

  /**
   * Establishes (or reuses) a session with a peer device, fetching their
   * bundle from the server if we haven't talked to them before.
   */
  async ensureSessionWith(peerName, peerDeviceId) {
    const peerAddress = new WasmProtocolAddress(peerName, peerDeviceId);

    const hasSession = await this.sessionStore.has_session(peerAddress);
    if (hasSession) return peerAddress;

    // Maybe we have a persisted session from a previous page load.
    const savedSession = await store.loadSession(this.username, this.deviceId, peerName, peerDeviceId);
    if (savedSession) {
      await this.sessionStore.import_session(peerAddress, savedSession);
      return peerAddress;
    }

    // No session yet — fetch their bundle and establish one (X3DH/PQXDH).
    const bundle = await fetchPreKeyBundle(peerName, peerDeviceId);

    await processPreKeyBundle(
      peerAddress,
      this.address,
      bundle.registrationId,
      WasmPublicKey.deserialize(fromBase64(bundle.identityKey)),
      bundle.signedPreKey.id,
      WasmPublicKey.deserialize(fromBase64(bundle.signedPreKey.publicKey)),
      fromBase64(bundle.signedPreKey.signature),
      bundle.oneTimePreKey?.id ?? null,
      bundle.oneTimePreKey ? fromBase64(bundle.oneTimePreKey.publicKey) : null,
      bundle.kyberPreKey.id,
      fromBase64(bundle.kyberPreKey.publicKey),
      fromBase64(bundle.kyberPreKey.signature),
      this.sessionStore,
      this.identityStore
    );

    await this._persistSession(peerName, peerDeviceId, peerAddress);
    return peerAddress;
  }

  async _persistSession(peerName, peerDeviceId, peerAddress) {
    const sessionBytes = await this.sessionStore.export_session(peerAddress);
    if (sessionBytes) {
      await store.saveSession(this.username, this.deviceId, peerName, peerDeviceId, sessionBytes);
    }
  }

  /** Encrypts a plaintext string for a peer, establishing a session first if needed. */
  async encryptFor(peerName, peerDeviceId, plaintext) {
    const peerAddress = await this.ensureSessionWith(peerName, peerDeviceId);

    const ciphertext = await wasmEncryptMessage(
      new TextEncoder().encode(plaintext),
      peerAddress,
      this.address,
      this.sessionStore,
      this.identityStore
    );

    await this._persistSession(peerName, peerDeviceId, peerAddress);

    return {
      ciphertextType: ciphertext.message_type,
      ciphertextBase64: toBase64(ciphertext.body),
    };
  }

  /** Decrypts an incoming envelope (as delivered by the WebSocket) back to a string. */
  async decryptEnvelope(envelope) {
    const senderAddress = new WasmProtocolAddress(envelope.from, envelope.fromDeviceId);

    const plaintextBytes = await wasmDecryptMessage(
      fromBase64(envelope.ciphertext),
      envelope.ciphertextType,
      senderAddress,
      this.address,
      this.sessionStore,
      this.identityStore,
      this.preKeyStore,
      this.signedPreKeyStore,
      this.kyberPreKeyStore
    );

    await this._persistSession(envelope.from, envelope.fromDeviceId, senderAddress);

    return new TextDecoder().decode(plaintextBytes);
  }
}
