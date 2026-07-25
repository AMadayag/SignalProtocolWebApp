-- Add the column as nullable first, since existing rows have no value yet
ALTER TABLE "Message" ADD COLUMN "ciphertextHash" TEXT;

-- Backfill existing rows with a real SHA-256 hash of their actual stored
-- ciphertext, computed the same way integrity.ts computes it — so old
-- messages get a genuinely valid hash, not a placeholder that would fail
-- verification later.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE "Message" SET "ciphertextHash" = encode(digest("ciphertext", 'sha256'), 'hex');

-- Now that every row has a value, make it required
ALTER TABLE "Message" ALTER COLUMN "ciphertextHash" SET NOT NULL;
