import { describe, it, expect } from 'vitest';
import {
  describeRequest,
  normalizeRole,
  cleanUsername,
  formatAssetAmount,
  isDAppRequestType,
  DAPP_REQUEST_TYPES,
} from './requests';
import type { DAppRequest } from '@/core/types';

function req(type: DAppRequest['type'], payload: any): DAppRequest {
  return { id: 'r1', type, payload, origin: 'https://peakd.com', tabId: 1, timestamp: 0 };
}

describe('normalizeRole', () => {
  it('lowercases Keychain-style role names', () => {
    expect(normalizeRole('Posting', 'active')).toBe('posting');
    expect(normalizeRole('ACTIVE', 'posting')).toBe('active');
    expect(normalizeRole('Memo', 'posting')).toBe('memo');
  });

  it('falls back for unknown input', () => {
    expect(normalizeRole('owner-ish', 'posting')).toBe('posting');
    expect(normalizeRole(undefined, 'active')).toBe('active');
    expect(normalizeRole(42, 'memo')).toBe('memo');
  });
});

describe('cleanUsername', () => {
  it('strips @ and whitespace and lowercases', () => {
    expect(cleanUsername(' @Alice ')).toBe('alice');
  });
  it('returns null for empty or non-string', () => {
    expect(cleanUsername('')).toBeNull();
    expect(cleanUsername(null)).toBeNull();
    expect(cleanUsername(undefined)).toBeNull();
  });
});

describe('formatAssetAmount', () => {
  it('formats numbers and strings to 3 decimals with currency', () => {
    expect(formatAssetAmount('1', 'HIVE')).toBe('1.000 HIVE');
    expect(formatAssetAmount(2.5, 'hbd')).toBe('2.500 HBD');
    expect(formatAssetAmount('10.1234 HIVE', 'HIVE')).toBe('10.123 HIVE');
  });
  it('returns a zero amount for garbage', () => {
    expect(formatAssetAmount('abc', 'HIVE')).toBe('0.000 HIVE');
  });
});

describe('isDAppRequestType', () => {
  it('accepts every declared type and rejects internal ones', () => {
    for (const t of DAPP_REQUEST_TYPES) expect(isDAppRequestType(t)).toBe(true);
    expect(isDAppRequestType('UNLOCK')).toBe(false);
    expect(isDAppRequestType('REQUEST_RESPONSE')).toBe(false);
    expect(isDAppRequestType(undefined)).toBe(false);
  });
});

describe('describeRequest', () => {
  it('describes a transfer as sensitive and active-key', () => {
    const d = describeRequest(req('TRANSFER', { from: 'alice', to: 'bob', amount: '1.000 HIVE', memo: 'hi' }));
    expect(d.title).toBe('Transfer');
    expect(d.keyRole).toBe('active');
    expect(d.username).toBe('alice');
    expect(d.isSensitive).toBe(true);
    expect(d.fields.map((f) => f.label)).toEqual(['To', 'Amount', 'Memo']);
  });

  it('describes a vote with posting key and percentage', () => {
    const d = describeRequest(req('VOTE', { voter: 'alice', author: 'bob', permlink: 'post', weight: 5000 }));
    expect(d.title).toBe('Upvote');
    expect(d.keyRole).toBe('posting');
    expect(d.summary).toContain('50%');
    expect(d.isSensitive).toBe(false);
  });

  it('labels negative votes as downvotes', () => {
    const d = describeRequest(req('VOTE', { voter: 'alice', author: 'bob', permlink: 'post', weight: -10000 }));
    expect(d.title).toBe('Downvote');
  });

  it('uses the role from a custom_json payload, case-insensitively', () => {
    const d = describeRequest(req('CUSTOM_JSON', { username: 'alice', id: 'sm_x', json: '{"a":1}', role: 'Active' }));
    expect(d.keyRole).toBe('active');
    expect(d.isSensitive).toBe(true);
    expect(d.fields[1].code).toBe(true);
    expect(d.fields[1].value).toContain('"a": 1');
  });

  it('leaves username null when the dApp did not specify one', () => {
    const d = describeRequest(req('SIGN_BUFFER', { username: null, message: 'login', role: 'posting' }));
    expect(d.username).toBeNull();
    expect(d.keyRole).toBe('posting');
  });

  it('marks witness votes, proxy and proposal votes as active-key operations', () => {
    expect(describeRequest(req('WITNESS_VOTE', { account: 'a', witness: 'w', approve: true })).keyRole).toBe('active');
    expect(describeRequest(req('PROXY', { account: 'a', proxy: 'p' })).keyRole).toBe('active');
    expect(
      describeRequest(req('UPDATE_PROPOSAL_VOTE', { voter: 'a', proposal_ids: [1, 2], approve: true })).summary
    ).toContain('#1, #2');
  });

  it('describes the broadcast operation names', () => {
    const d = describeRequest(
      req('BROADCAST', {
        username: 'a',
        role: 'posting',
        operations: [
          ['vote', {}],
          ['custom_json', {}],
        ],
      })
    );
    expect(d.summary).toContain('vote, custom_json');
  });

  it('defaults signed calls to posting unless active is requested', () => {
    expect(describeRequest(req('SIGNED_CALL', { username: 'a', method: 'm', params: '{}' })).keyRole).toBe('posting');
    expect(
      describeRequest(req('SIGNED_CALL', { username: 'a', method: 'm', params: '{}', typeWif: 'Active' })).keyRole
    ).toBe('active');
  });

  it('handles unknown types without throwing', () => {
    const d = describeRequest({ ...req('VOTE', {}), type: 'NOPE' as any });
    expect(d.title).toBe('Unknown Request');
  });
});
