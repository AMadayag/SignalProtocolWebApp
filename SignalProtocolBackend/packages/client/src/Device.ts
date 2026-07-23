/**
 * Represents one user's device: generates its identity + prekeys at
 * "registration" time, and exposes a public PreKeyBundle the way a real
 * server would serve one to anyone who wants to start a session with it.
 */
import * as Signal from '@signalapp/libsignal-client';
import { DeviceStores } from './Stores.js';

let nextKeyId = 1;
function freshId(): number {
  return nextKeyId++;
}

export class Device {
  readonly address: Signal.ProtocolAddress;
  readonly stores: DeviceStores;
  private identityKeyPair: Signal.IdentityKeyPair;
  private registrationId: number;
  private signedPreKeyId!: number;
  private preKeyId!: number;
  private kyberPreKeyId!: number;

  private constructor(
    name: string,
    deviceId: number,
    identityKeyPair: Signal.IdentityKeyPair,
    registrationId: number
  ) {
    this.address = Signal.ProtocolAddress.new(name, deviceId);
    this.identityKeyPair = identityKeyPair;
    this.registrationId = registrationId;
    this.stores = new DeviceStores(identityKeyPair, registrationId);
  }

  /** Simulates the one-time "registration" flow a client does on first install. */
  static async register(name: string, deviceId = 1): Promise<Device> {
    const identityKeyPair = Signal.IdentityKeyPair.generate();
    // Registration ID: a per-installation random value used to disambiguate sessions.
    const registrationId = Math.floor(Math.random() * 16380) + 1;

    const device = new Device(name, deviceId, identityKeyPair, registrationId);

    // One signed prekey, rotated periodically in a real app.
    const signedPreKeyId = freshId();
    const signedPreKeyPair = Signal.PrivateKey.generate();
    const signedPreKeySignature = identityKeyPair.privateKey.sign(
      signedPreKeyPair.getPublicKey().serialize()
    );
    const signedPreKeyRecord = Signal.SignedPreKeyRecord.new(
      signedPreKeyId,
      Date.now(),
      signedPreKeyPair.getPublicKey(),
      signedPreKeyPair,
      signedPreKeySignature
    );
    await device.stores.signedPreKeyStore.saveSignedPreKey(signedPreKeyId, signedPreKeyRecord);
    device.signedPreKeyId = signedPreKeyId;

    // A batch of one-time prekeys would normally be generated; we just make one for the demo.
    const preKeyId = freshId();
    const preKeyPair = Signal.PrivateKey.generate();
    const preKeyRecord = Signal.PreKeyRecord.new(preKeyId, preKeyPair.getPublicKey(), preKeyPair);
    await device.stores.preKeyStore.savePreKey(preKeyId, preKeyRecord);
    device.preKeyId = preKeyId;

    // Post-quantum (Kyber) one-time prekey, required for PQXDH in current libsignal.
    const kyberPreKeyId = freshId();
    const kyberKeyPair = Signal.KEMKeyPair.generate();
    const kyberSignature = identityKeyPair.privateKey.sign(
      kyberKeyPair.getPublicKey().serialize()
    );
    const kyberPreKeyRecord = Signal.KyberPreKeyRecord.new(
      kyberPreKeyId,
      Date.now(),
      kyberKeyPair,
      kyberSignature
    );
    await device.stores.kyberPreKeyStore.saveKyberPreKey(kyberPreKeyId, kyberPreKeyRecord);
    device.kyberPreKeyId = kyberPreKeyId;

    return device;
  }

  /**
   * What this device would publish to the server for others to fetch.
   * Contains only public material — nothing here can decrypt anything on its own.
   */
  async getPreKeyBundle(): Promise<Signal.PreKeyBundle> {
    const signedPreKeyRecord = await this.stores.signedPreKeyStore.getSignedPreKey(this.signedPreKeyId);
    const preKeyRecord = await this.stores.preKeyStore.getPreKey(this.preKeyId);
    const kyberPreKeyRecord = await this.stores.kyberPreKeyStore.getKyberPreKey(this.kyberPreKeyId);

    return Signal.PreKeyBundle.new(
      this.registrationId,
      this.address.deviceId(),
      preKeyRecord.id(),
      preKeyRecord.publicKey(),
      signedPreKeyRecord.id(),
      signedPreKeyRecord.publicKey(),
      signedPreKeyRecord.signature(),
      this.identityKeyPair.publicKey,
      kyberPreKeyRecord.id(),
      kyberPreKeyRecord.publicKey(),
      kyberPreKeyRecord.signature()
    );
  }
}
