/**
 * End-to-end proof of concept:
 *   1. Alice and Bob each "register" (generate identity keys + prekeys).
 *   2. Bob publishes a PreKeyBundle (simulating a server fetch).
 *   3. Alice uses it to establish a session and send Bob an encrypted first message.
 *   4. Bob decrypts it, establishing his side of the session automatically.
 *   5. They exchange a couple more messages to show the ongoing (Double Ratchet) session.
 */
import * as Signal from '@signalapp/libsignal-client';
import { Device } from './Device.js';

function show(label: string, bytes: Uint8Array) {
  console.log(`  ${label}: ${Buffer.from(bytes).toString('base64').slice(0, 40)}...`);
}

async function main() {
  console.log('--- Registration ---');
  const alice = await Device.register('alice', 1);
  const bob = await Device.register('bob', 1);
  console.log('Alice and Bob each generated an identity key pair + prekeys.\n');

  console.log('--- Alice fetches Bob\'s prekey bundle from the "server" ---');
  const bobBundle = await bob.getPreKeyBundle();
  console.log('(Only public keys travel over the network here.)\n');

  console.log('--- Alice establishes a session with Bob (X3DH/PQXDH) ---');
  await Signal.processPreKeyBundle(
    bobBundle,
    bob.address,
    alice.address,
    alice.stores.sessionStore,
    alice.stores.identityStore
  );
  console.log('Session established on Alice\'s side.\n');

  console.log('--- Alice encrypts and sends the first message ---');
  const firstMessage = 'Hey Bob, this is Alice. Can you talk?';
  const ciphertext1 = await Signal.signalEncrypt(
    Buffer.from(firstMessage, 'utf8'),
    bob.address,
    alice.address,
    alice.stores.sessionStore,
    alice.stores.identityStore
  );
  console.log(`Plaintext: "${firstMessage}"`);
  show('Ciphertext (base64, truncated)', ciphertext1.serialize());
  console.log(`Message type: ${ciphertext1.type()} (3 = PreKeySignalMessage, the first message in a session)\n`);

  console.log('--- Bob receives and decrypts it (this also completes his side of the session) ---');
  const preKeyMessage = Signal.PreKeySignalMessage.deserialize(ciphertext1.serialize());
  const decrypted1 = await Signal.signalDecryptPreKey(
    preKeyMessage,
    alice.address,
    bob.address,
    bob.stores.sessionStore,
    bob.stores.identityStore,
    bob.stores.preKeyStore,
    bob.stores.signedPreKeyStore,
    bob.stores.kyberPreKeyStore
  );
  console.log(`Bob decrypted: "${Buffer.from(decrypted1).toString('utf8')}"\n`);

  console.log('--- Bob replies (now a normal, established-session message) ---');
  const replyText = 'Alice! Yeah, what\'s up?';
  const ciphertext2 = await Signal.signalEncrypt(
    Buffer.from(replyText, 'utf8'),
    alice.address,
    bob.address,
    bob.stores.sessionStore,
    bob.stores.identityStore
  );
  console.log(`Plaintext: "${replyText}"`);
  console.log(`Message type: ${ciphertext2.type()} (2 = SignalMessage, ordinary ratcheted message)\n`);

  console.log('--- Alice decrypts Bob\'s reply ---');
  const signalMessage = Signal.SignalMessage.deserialize(ciphertext2.serialize());
  const decrypted2 = await Signal.signalDecrypt(
    signalMessage,
    bob.address,
    alice.address,
    alice.stores.sessionStore,
    alice.stores.identityStore
  );
  console.log(`Alice decrypted: "${Buffer.from(decrypted2).toString('utf8')}"\n`);

  console.log('--- One more round trip to show the ratchet advancing ---');
  const followUp = 'Just testing an encrypted chat app I\'m building 🔐';
  const ciphertext3 = await Signal.signalEncrypt(
    Buffer.from(followUp, 'utf8'),
    bob.address,
    alice.address,
    alice.stores.sessionStore,
    alice.stores.identityStore
  );
  const decrypted3 = await Signal.signalDecrypt(
    Signal.SignalMessage.deserialize(ciphertext3.serialize()),
    alice.address,
    bob.address,
    bob.stores.sessionStore,
    bob.stores.identityStore
  );
  console.log(`Alice sent: "${followUp}"`);
  console.log(`Bob decrypted: "${Buffer.from(decrypted3).toString('utf8')}"\n`);

  console.log('Done. Each message used a fresh derived key (forward secrecy) even though only one session was established.');
}

main().catch((err) => {
  console.error('Error running demo:', err);
  process.exit(1);
});
