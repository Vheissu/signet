import { describe, it, expect } from 'vitest';
import { buildTransferUri, buildReceiveUri, parseTransferUri } from './index';

describe('QR Code Utilities', () => {
  describe('buildTransferUri', () => {
    it('builds a basic transfer URI', () => {
      const uri = buildTransferUri({ to: 'alice' });
      expect(uri).toBe('hive://transfer?to=alice');
    });

    it('includes amount and currency', () => {
      const uri = buildTransferUri({
        to: 'bob',
        amount: '10.000',
        currency: 'HIVE',
      });
      expect(uri).toContain('to=bob');
      expect(uri).toContain('amount=10.000');
      expect(uri).toContain('currency=HIVE');
    });

    it('includes memo', () => {
      const uri = buildTransferUri({
        to: 'charlie',
        amount: '5.000',
        currency: 'HBD',
        memo: 'payment for coffee',
      });
      expect(uri).toContain('memo=payment+for+coffee');
    });

    it('omits undefined fields', () => {
      const uri = buildTransferUri({ to: 'dave' });
      expect(uri).not.toContain('amount');
      expect(uri).not.toContain('currency');
      expect(uri).not.toContain('memo');
    });
  });

  describe('buildReceiveUri', () => {
    it('builds a receive URI with just username', () => {
      const uri = buildReceiveUri('alice');
      expect(uri).toBe('hive://transfer?to=alice');
    });
  });

  describe('parseTransferUri', () => {
    it('parses a full transfer URI', () => {
      const result = parseTransferUri('hive://transfer?to=alice&amount=10.000&currency=HIVE&memo=test');
      expect(result).toEqual({
        to: 'alice',
        amount: '10.000',
        currency: 'HIVE',
        memo: 'test',
      });
    });

    it('parses a minimal URI with just recipient', () => {
      const result = parseTransferUri('hive://transfer?to=bob');
      expect(result).toEqual({
        to: 'bob',
        amount: undefined,
        currency: undefined,
        memo: undefined,
      });
    });

    it('returns null for invalid URI with no "to" param', () => {
      const result = parseTransferUri('hive://transfer?amount=10');
      expect(result).toBeNull();
    });

    it('parses a plain username as a receive URI', () => {
      const result = parseTransferUri('alice');
      expect(result).toEqual({ to: 'alice' });
    });

    it('strips @ from usernames', () => {
      const result = parseTransferUri('@alice');
      expect(result).toEqual({ to: 'alice' });
    });

    it('returns null for completely invalid input', () => {
      const result = parseTransferUri('not a valid thing!!!');
      expect(result).toBeNull();
    });

    it('roundtrips with buildTransferUri', () => {
      const original = { to: 'alice', amount: '25.500', currency: 'HIVE', memo: 'hello' };
      const uri = buildTransferUri(original);
      const parsed = parseTransferUri(uri);
      expect(parsed).toEqual(original);
    });
  });
});
