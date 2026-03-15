import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptToString, decryptFromString, verifyPassword } from './encryption';

describe('Encryption Module', () => {
  const password = 'test-password-123!';
  const plaintext = 'hello world secret data';

  describe('encrypt / decrypt roundtrip', () => {
    it('decrypts to the original plaintext', async () => {
      const payload = await encrypt(plaintext, password);
      const result = await decrypt(payload, password);
      expect(result).toBe(plaintext);
    });

    it('produces different ciphertext each time (random IV/salt)', async () => {
      const a = await encrypt(plaintext, password);
      const b = await encrypt(plaintext, password);
      expect(a.ct).not.toBe(b.ct);
      expect(a.iv).not.toBe(b.iv);
      expect(a.s).not.toBe(b.s);
    });

    it('fails decryption with wrong password', async () => {
      const payload = await encrypt(plaintext, password);
      await expect(decrypt(payload, 'wrong-password')).rejects.toThrow();
    });

    it('fails decryption if ciphertext is tampered with', async () => {
      const payload = await encrypt(plaintext, password);
      // Flip a character in the ciphertext
      const tampered = {
        ...payload,
        ct: payload.ct.slice(0, -2) + (payload.ct.endsWith('AA') ? 'BB' : 'AA'),
      };
      await expect(decrypt(tampered, password)).rejects.toThrow();
    });

    it('handles empty string', async () => {
      const payload = await encrypt('', password);
      const result = await decrypt(payload, password);
      expect(result).toBe('');
    });

    it('handles unicode content', async () => {
      const unicode = 'Hello 世界! 🔑 Ñoño';
      const payload = await encrypt(unicode, password);
      const result = await decrypt(payload, password);
      expect(result).toBe(unicode);
    });

    it('handles long content', async () => {
      const longText = 'x'.repeat(100_000);
      const payload = await encrypt(longText, password);
      const result = await decrypt(payload, password);
      expect(result).toBe(longText);
    });
  });

  describe('encryptToString / decryptFromString', () => {
    it('roundtrips an object through JSON serialization', async () => {
      const obj = { username: 'alice', keys: { posting: '5xxx', active: '5yyy' } };
      const encrypted = await encryptToString(obj, password);
      expect(typeof encrypted).toBe('string');

      const result = await decryptFromString(encrypted, password);
      expect(result).toEqual(obj);
    });

    it('handles arrays', async () => {
      const arr = [1, 'two', { three: 3 }];
      const encrypted = await encryptToString(arr, password);
      const result = await decryptFromString(encrypted, password);
      expect(result).toEqual(arr);
    });

    it('fails with wrong password', async () => {
      const encrypted = await encryptToString({ secret: true }, password);
      await expect(decryptFromString(encrypted, 'nope')).rejects.toThrow();
    });
  });

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      const encrypted = await encryptToString('check', password);
      const valid = await verifyPassword(encrypted, password);
      expect(valid).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const encrypted = await encryptToString('check', password);
      const valid = await verifyPassword(encrypted, 'bad');
      expect(valid).toBe(false);
    });
  });

  describe('payload format', () => {
    it('contains ct, iv, and s fields as base64 strings', async () => {
      const payload = await encrypt(plaintext, password);
      expect(payload).toHaveProperty('ct');
      expect(payload).toHaveProperty('iv');
      expect(payload).toHaveProperty('s');
      expect(typeof payload.ct).toBe('string');
      expect(typeof payload.iv).toBe('string');
      expect(typeof payload.s).toBe('string');
      // Base64 characters only
      expect(payload.ct).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(payload.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
      expect(payload.s).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('IV is 16 bytes (12 bytes base64-encoded)', async () => {
      const payload = await encrypt(plaintext, password);
      const ivBytes = atob(payload.iv).length;
      expect(ivBytes).toBe(12); // AES-GCM standard IV
    });

    it('salt is 16 bytes', async () => {
      const payload = await encrypt(plaintext, password);
      const saltBytes = atob(payload.s).length;
      expect(saltBytes).toBe(16);
    });
  });
});
