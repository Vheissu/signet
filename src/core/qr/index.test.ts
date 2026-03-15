import { describe, it, expect } from 'vitest';
import {
  buildTransferUri,
  buildReceiveUri,
  buildHivesignerUrl,
  parseTransferUri,
} from './index';

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

  describe('buildHivesignerUrl', () => {
    it('builds a Hivesigner URL with amount', () => {
      const url = buildHivesignerUrl({
        to: 'alice',
        amount: '10.000',
        currency: 'HIVE',
      });
      expect(url).toContain('hivesigner.com/sign/transfer');
      expect(url).toContain('to=alice');
      expect(url).toContain('amount=10.000+HIVE');
    });

    it('builds a Hivesigner URL without amount', () => {
      const url = buildHivesignerUrl({ to: 'bob' });
      expect(url).toContain('to=bob');
      expect(url).not.toContain('amount=');
    });

    it('includes memo', () => {
      const url = buildHivesignerUrl({
        to: 'charlie',
        amount: '5.000',
        currency: 'HBD',
        memo: 'test',
      });
      expect(url).toContain('memo=test');
    });
  });

  describe('parseTransferUri', () => {
    it('parses a full hive:// URI', () => {
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

    it('parses a Hivesigner URL', () => {
      const result = parseTransferUri(
        'https://hivesigner.com/sign/transfer?to=alice&amount=10.000+HIVE&memo=thanks'
      );
      expect(result).toEqual({
        to: 'alice',
        amount: '10.000',
        currency: 'HIVE',
        memo: 'thanks',
      });
    });

    it('parses a Hivesigner URL without amount', () => {
      const result = parseTransferUri(
        'https://hivesigner.com/sign/transfer?to=bob'
      );
      expect(result).toEqual({
        to: 'bob',
        amount: undefined,
        currency: undefined,
        memo: undefined,
      });
    });

    it('returns null for invalid URI with no "to" param', () => {
      expect(parseTransferUri('hive://transfer?amount=10')).toBeNull();
    });

    it('parses a plain username', () => {
      expect(parseTransferUri('alice')).toEqual({ to: 'alice' });
    });

    it('strips @ from usernames', () => {
      expect(parseTransferUri('@alice')).toEqual({ to: 'alice' });
    });

    it('returns null for invalid input', () => {
      expect(parseTransferUri('not a valid thing!!!')).toBeNull();
    });

    it('roundtrips hive:// URI', () => {
      const original = { to: 'alice', amount: '25.500', currency: 'HIVE', memo: 'hello' };
      const uri = buildTransferUri(original);
      const parsed = parseTransferUri(uri);
      expect(parsed).toEqual(original);
    });

    it('roundtrips Hivesigner URL', () => {
      const original = { to: 'bob', amount: '5.000', currency: 'HBD', memo: 'payment' };
      const url = buildHivesignerUrl(original);
      const parsed = parseTransferUri(url);
      expect(parsed).toEqual(original);
    });
  });
});
