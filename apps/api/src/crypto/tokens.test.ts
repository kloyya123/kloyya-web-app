import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createTokenCrypto, parseEncryptionKey, TokenCryptoError } from './tokens.js';

/**
 * These are customers' Google tokens, so the tests are about the properties that
 * make a leak survivable — not merely that a round trip works.
 */
const KEY = randomBytes(32).toString('base64');
const OTHER_KEY = randomBytes(32).toString('base64');

describe('token encryption', () => {
  it('round-trips a token', () => {
    const crypto = createTokenCrypto(KEY);
    const token = 'ya29.a0AfB_byC-not-a-real-google-token';

    expect(crypto.decrypt(crypto.encrypt(token))).toBe(token);
  });

  it('never produces the same ciphertext twice', () => {
    const crypto = createTokenCrypto(KEY);
    const token = 'the-same-token';

    const a = crypto.encrypt(token);
    const b = crypto.encrypt(token);

    // Equal ciphertexts would reveal which accounts share a token, and let rows
    // be swapped undetectably.
    expect(a).not.toBe(b);
    expect(crypto.decrypt(a)).toBe(token);
    expect(crypto.decrypt(b)).toBe(token);
  });

  it('does not leak the token into its ciphertext', () => {
    const crypto = createTokenCrypto(KEY);
    const encoded = crypto.encrypt('super-secret-refresh-token');

    expect(encoded).not.toContain('super-secret');
    expect(encoded.startsWith('v1.')).toBe(true);
  });

  it('detects tampering rather than decrypting something plausible', () => {
    const crypto = createTokenCrypto(KEY);
    const encoded = crypto.encrypt('original-token');
    const [version, iv, tag, data] = encoded.split('.') as [string, string, string, string];

    // Flip a byte of the ciphertext.
    const bytes = Buffer.from(data, 'base64url');
    bytes[0] = (bytes[0]! ^ 0xff) & 0xff;
    const tampered = [version, iv, tag, bytes.toString('base64url')].join('.');

    expect(() => crypto.decrypt(tampered)).toThrow(TokenCryptoError);
  });

  it('rejects a swapped auth tag', () => {
    const crypto = createTokenCrypto(KEY);
    const a = crypto.encrypt('token-a').split('.');
    const b = crypto.encrypt('token-b').split('.');

    const frankenstein = [a[0], a[1], b[2], a[3]].join('.');
    expect(() => crypto.decrypt(frankenstein)).toThrow(TokenCryptoError);
  });

  it('cannot be read with a different key', () => {
    const encoded = createTokenCrypto(KEY).encrypt('token');
    const attacker = createTokenCrypto(OTHER_KEY);

    // The point of encrypting at rest: the database alone is not enough.
    expect(() => attacker.decrypt(encoded)).toThrow(TokenCryptoError);
  });

  it('refuses an unknown version, so a rotation cannot fail silently', () => {
    const crypto = createTokenCrypto(KEY);
    const encoded = crypto.encrypt('token').replace(/^v1\./, 'v2.');

    expect(() => crypto.decrypt(encoded)).toThrow(/Unsupported encrypted token version/);
  });

  it('refuses a malformed payload', () => {
    const crypto = createTokenCrypto(KEY);
    expect(() => crypto.decrypt('nonsense')).toThrow(/malformed/);
  });

  describe('key validation', () => {
    it('accepts a 32-byte base64 key', () => {
      expect(parseEncryptionKey(KEY)).toHaveLength(32);
    });

    it('refuses a short key loudly rather than padding it', () => {
      const short = randomBytes(16).toString('base64');
      // Silently accepting this would give AES-128 security from a config that
      // claims AES-256.
      expect(() => parseEncryptionKey(short)).toThrow(/must decode to 32 bytes/);
    });

    it('tells you how to generate a valid one', () => {
      expect(() => parseEncryptionKey('too-short')).toThrow(/randomBytes\(32\)/);
    });
  });
});
