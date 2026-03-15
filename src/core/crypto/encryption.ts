/**
 * Signet Encryption Module
 *
 * Uses the Web Crypto API exclusively for all cryptographic operations.
 * This is significantly more secure than JavaScript-based crypto libraries:
 *
 * - AES-256-GCM (authenticated encryption) prevents tampering
 * - PBKDF2 with 600,000 iterations (vs Keychain's 10,000) for key derivation
 * - Native implementation resistant to timing attacks
 * - CryptoKey objects cannot be inspected from JavaScript
 */

import type { EncryptedPayload } from '@/core/types';

const PBKDF2_ITERATIONS = 600_000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12;   // 96 bits (AES-GCM standard)
const KEY_LENGTH = 256;  // AES-256

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string with a password.
 * Generates a random salt and IV for each encryption.
 */
export async function encrypt(plaintext: string, password: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoder.encode(plaintext)
  );

  return {
    ct: toBase64(encrypted),
    iv: toBase64(iv),
    s: toBase64(salt),
  };
}

/**
 * Decrypt an encrypted payload with a password.
 * Throws if the password is incorrect (GCM authentication fails).
 */
export async function decrypt(payload: EncryptedPayload, password: string): Promise<string> {
  const salt = fromBase64(payload.s);
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ct);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt a value and return as a JSON string.
 */
export async function encryptToString(value: any, password: string): Promise<string> {
  const json = JSON.stringify(value);
  const payload = await encrypt(json, password);
  return JSON.stringify(payload);
}

/**
 * Decrypt a JSON string payload and parse the result.
 */
export async function decryptFromString<T = any>(encrypted: string, password: string): Promise<T> {
  const payload: EncryptedPayload = JSON.parse(encrypted);
  const json = await decrypt(payload, password);
  return JSON.parse(json);
}

/**
 * Verify a password against encrypted data.
 * Returns true if decryption succeeds, false otherwise.
 */
export async function verifyPassword(encrypted: string, password: string): Promise<boolean> {
  try {
    await decryptFromString(encrypted, password);
    return true;
  } catch {
    return false;
  }
}
