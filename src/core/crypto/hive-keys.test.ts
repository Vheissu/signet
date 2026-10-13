import { describe, it, expect } from 'vitest';
import { PrivateKey } from '@hiveio/dhive';
import {
  signBuffer,
  verifyBufferSignature,
  encodeMemo,
  decodeMemo,
  isEncryptedMemo,
  getPublicFromPrivate,
  deriveKeysFromPassword,
  identifyKeyRole,
} from './hive-keys';

const alice = PrivateKey.fromSeed('alice-test').toString();
const bob = PrivateKey.fromSeed('bob-test').toString();

describe('signBuffer', () => {
  it('signs arbitrary-length messages (hashes first)', () => {
    const sig = signBuffer('Login challenge: abc123 — a message that is not 32 bytes', alice);
    expect(sig).toMatch(/^[0-9a-f]{130}$/);
  });

  it('produces a signature that verifies against the public key', () => {
    const message = 'hello hive';
    const sig = signBuffer(message, alice);
    expect(verifyBufferSignature(message, sig, getPublicFromPrivate(alice))).toBe(true);
    expect(verifyBufferSignature('tampered', sig, getPublicFromPrivate(alice))).toBe(false);
    expect(verifyBufferSignature(message, sig, getPublicFromPrivate(bob))).toBe(false);
  });

  it('accepts raw bytes', () => {
    const sig = signBuffer(new TextEncoder().encode('bytes'), alice);
    expect(verifyBufferSignature('bytes', sig, getPublicFromPrivate(alice))).toBe(true);
  });
});

describe('memo encryption', () => {
  it('round-trips a message between two parties', () => {
    const encrypted = encodeMemo('secret payment ref', alice, getPublicFromPrivate(bob));
    expect(encrypted.startsWith('#')).toBe(true);
    expect(encrypted).not.toContain('secret');
    expect(decodeMemo(encrypted, bob)).toBe('secret payment ref');
    // The sender can read their own memo too
    expect(decodeMemo(encrypted, alice)).toBe('secret payment ref');
  });

  it('does not double-prefix messages that already start with #', () => {
    const encrypted = encodeMemo('#already', alice, getPublicFromPrivate(bob));
    expect(decodeMemo(encrypted, bob)).toBe('already');
  });

  it('returns plaintext memos untouched', () => {
    expect(decodeMemo('plain memo', bob)).toBe('plain memo');
  });

  it('detects encrypted memos', () => {
    expect(isEncryptedMemo('#abc')).toBe(true);
    expect(isEncryptedMemo('#')).toBe(false);
    expect(isEncryptedMemo('abc')).toBe(false);
    expect(isEncryptedMemo(undefined)).toBe(false);
  });
});

describe('key derivation', () => {
  it('derives four roles from a master password and matches them on an account', () => {
    const keys = deriveKeysFromPassword('alice', 'P5JtestMasterPassword');
    expect(keys.map((k) => k.role)).toEqual(['owner', 'active', 'posting', 'memo']);

    const byRole = Object.fromEntries(keys.map((k) => [k.role, k]));
    const account = {
      owner: { key_auths: [[byRole.owner.public, 1]] },
      active: { key_auths: [[byRole.active.public, 1]] },
      posting: { key_auths: [[byRole.posting.public, 1]] },
      memo_key: byRole.memo.public,
    };
    expect(identifyKeyRole(byRole.posting.private, account)).toBe('posting');
    expect(identifyKeyRole(byRole.active.private, account)).toBe('active');
    expect(identifyKeyRole(byRole.memo.private, account)).toBe('memo');
    expect(identifyKeyRole(byRole.owner.private, account)).toBe('owner');
    expect(identifyKeyRole(bob, account)).toBeNull();
  });
});
