import crypto from 'node:crypto';

/** SHA-256 hex digest of a ciphertext string, computed at write time and re-checked at read time. */
export function hashCiphertext(ciphertext: string): string {
  return crypto.createHash('sha256').update(ciphertext, 'utf8').digest('hex');
}

/** Returns true if `ciphertext` still matches the hash stored for it. */
export function verifyCiphertextHash(ciphertext: string, expectedHash: string): boolean {
  return hashCiphertext(ciphertext) === expectedHash;
}
