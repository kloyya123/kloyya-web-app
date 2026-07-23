import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Encryption for third-party OAuth tokens at rest.
 *
 * KESM requires connector tokens to be encrypted at rest and never returned by
 * any endpoint. These are not our credentials — they are a customer's access to
 * their own Gmail, Calendar and Drive. A database leak that hands out working
 * Google tokens is categorically worse than one that leaks our own data, so this
 * is the one place in the codebase where "the database is a trust boundary" is
 * taken literally.
 *
 * AES-256-GCM: authenticated, so tampering is detected rather than decrypted
 * into something plausible. A fresh random IV per encryption means the same
 * token never produces the same ciphertext twice — otherwise equal ciphertexts
 * would reveal which accounts share a token, and a swap between rows would go
 * unnoticed.
 *
 * Wire format: `v1.<iv>.<authTag>.<ciphertext>`, all base64url. The version
 * prefix exists so a key rotation is a migration rather than an outage: a future
 * v2 can be introduced while v1 rows are still readable.
 */
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96 bits, the GCM standard
const KEY_BYTES = 32; // AES-256

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenCryptoError';
  }
}

/**
 * Decode and validate the key. A short key is refused loudly rather than
 * silently padded into something weaker than it looks.
 */
export function parseEncryptionKey(base64Key: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(base64Key, 'base64');
  } catch {
    throw new TokenCryptoError('TOKEN_ENCRYPTION_KEY is not valid base64.');
  }
  if (key.length !== KEY_BYTES) {
    throw new TokenCryptoError(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  return key;
}

export interface TokenCrypto {
  encrypt(plaintext: string): string;
  decrypt(encoded: string): string;
}

export function createTokenCrypto(base64Key: string): TokenCrypto {
  const key = parseEncryptionKey(base64Key);

  return {
    encrypt(plaintext: string): string {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return [
        VERSION,
        iv.toString('base64url'),
        authTag.toString('base64url'),
        ciphertext.toString('base64url'),
      ].join('.');
    },

    decrypt(encoded: string): string {
      const parts = encoded.split('.');
      if (parts.length !== 4) {
        throw new TokenCryptoError('Encrypted token is malformed.');
      }
      const [version, ivPart, tagPart, dataPart] = parts as [string, string, string, string];

      // Compared in constant time out of habit rather than necessity: the version
      // isn't secret, but making "is this ours" checks timing-safe by default is
      // cheaper than deciding case by case which ones matter.
      const expected = Buffer.from(VERSION);
      const actual = Buffer.from(version);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw new TokenCryptoError(`Unsupported encrypted token version: ${version}`);
      }

      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

      try {
        return Buffer.concat([
          decipher.update(Buffer.from(dataPart, 'base64url')),
          decipher.final(),
        ]).toString('utf8');
      } catch {
        // GCM's auth tag failed: the ciphertext, IV or tag was altered, or the
        // key is wrong. Which one it was is not something we can know, and not
        // something a caller should act on differently.
        throw new TokenCryptoError('Encrypted token failed authentication — it may have been altered.');
      }
    },
  };
}
