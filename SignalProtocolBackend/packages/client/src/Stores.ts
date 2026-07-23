/**
 * In-memory implementations of the store interfaces libsignal-client requires.
 *
 * In a real app these would be backed by persistent, secure storage
 * (e.g. SQLite/IndexedDB with the DB file itself encrypted at rest).
 * Every "device" in this demo gets its own set of stores, mirroring how
 * each physical device keeps its own local key material.
 */
import * as Signal from '@signalapp/libsignal-client';

export class InMemorySessionStore extends Signal.SessionStore {
  private sessions = new Map<string, Signal.SessionRecord>();

  async saveSession(name: Signal.ProtocolAddress, record: Signal.SessionRecord): Promise<void> {
    this.sessions.set(`${name.name()}.${name.deviceId()}`, record);
  }

  async getSession(name: Signal.ProtocolAddress): Promise<Signal.SessionRecord | null> {
    return this.sessions.get(`${name.name()}.${name.deviceId()}`) ?? null;
  }

  async getExistingSessions(addresses: Signal.ProtocolAddress[]): Promise<Signal.SessionRecord[]> {
    const out: Signal.SessionRecord[] = [];
    for (const addr of addresses) {
      const s = await this.getSession(addr);
      if (s) out.push(s);
    }
    return out;
  }
}

export class InMemoryIdentityKeyStore extends Signal.IdentityKeyStore {
  private knownIdentities = new Map<string, Signal.PublicKey>();

  constructor(
    private identityKeyPair: Signal.IdentityKeyPair,
    private registrationId: number
  ) {
    super();
  }

  async getIdentityKey(): Promise<Signal.PrivateKey> {
    return this.identityKeyPair.privateKey;
  }

  async getLocalRegistrationId(): Promise<number> {
    return this.registrationId;
  }

  async saveIdentity(name: Signal.ProtocolAddress, key: Signal.PublicKey): Promise<Signal.IdentityChange> {
    const addrKey = `${name.name()}.${name.deviceId()}`;
    const existing = this.knownIdentities.get(addrKey);
    this.knownIdentities.set(addrKey, key);
    if (existing && !existing.equals(key)) {
      return Signal.IdentityChange.ReplacedExisting;
    }
    return Signal.IdentityChange.NewOrUnchanged;
  }

  // In production: check against a locally pinned/trusted key and surface
  // a "safety number changed" warning to the user rather than blindly trusting.
  async isTrustedIdentity(): Promise<boolean> {
    return true;
  }

  async getIdentity(name: Signal.ProtocolAddress): Promise<Signal.PublicKey | null> {
    return this.knownIdentities.get(`${name.name()}.${name.deviceId()}`) ?? null;
  }
}

export class InMemoryPreKeyStore extends Signal.PreKeyStore {
  private store = new Map<number, Signal.PreKeyRecord>();

  async savePreKey(id: number, record: Signal.PreKeyRecord): Promise<void> {
    this.store.set(id, record);
  }

  async getPreKey(id: number): Promise<Signal.PreKeyRecord> {
    const rec = this.store.get(id);
    if (!rec) throw new Error(`PreKey ${id} not found`);
    return rec;
  }

  async removePreKey(id: number): Promise<void> {
    this.store.delete(id);
  }
}

export class InMemorySignedPreKeyStore extends Signal.SignedPreKeyStore {
  private store = new Map<number, Signal.SignedPreKeyRecord>();

  async saveSignedPreKey(id: number, record: Signal.SignedPreKeyRecord): Promise<void> {
    this.store.set(id, record);
  }

  async getSignedPreKey(id: number): Promise<Signal.SignedPreKeyRecord> {
    const rec = this.store.get(id);
    if (!rec) throw new Error(`SignedPreKey ${id} not found`);
    return rec;
  }
}

export class InMemoryKyberPreKeyStore extends Signal.KyberPreKeyStore {
  private store = new Map<number, Signal.KyberPreKeyRecord>();

  async saveKyberPreKey(id: number, record: Signal.KyberPreKeyRecord): Promise<void> {
    this.store.set(id, record);
  }

  async getKyberPreKey(id: number): Promise<Signal.KyberPreKeyRecord> {
    const rec = this.store.get(id);
    if (!rec) throw new Error(`KyberPreKey ${id} not found`);
    return rec;
  }

  // Signal's real client refuses to reuse a one-time Kyber prekey; this demo
  // only ever uses one, so we simply record the fact for illustration.
  async markKyberPreKeyUsed(id: number): Promise<void> {
    // no-op for this demo
  }
}

/** Bundles all the per-device stores together, the way a real client would. */
export class DeviceStores {
  readonly sessionStore = new InMemorySessionStore();
  readonly preKeyStore = new InMemoryPreKeyStore();
  readonly signedPreKeyStore = new InMemorySignedPreKeyStore();
  readonly kyberPreKeyStore = new InMemoryKyberPreKeyStore();
  readonly identityStore: InMemoryIdentityKeyStore;

  constructor(identityKeyPair: Signal.IdentityKeyPair, registrationId: number) {
    this.identityStore = new InMemoryIdentityKeyStore(identityKeyPair, registrationId);
  }
}
