import { describe, it, expect } from 'vitest';
import {
  buildTransferPayload,
  buildStakePayload,
  buildUnstakePayload,
  buildDelegatePayload,
  buildUndelegatePayload,
  buildHEOperation,
  HE_ID,
} from './api';

describe('Hive Engine API', () => {
  describe('HE_ID', () => {
    it('is the correct sidechain identifier', () => {
      expect(HE_ID).toBe('ssc-mainnet-hive');
    });
  });

  describe('buildHEOperation', () => {
    it('builds a valid JSON payload', () => {
      const json = buildHEOperation('tokens', 'transfer', { symbol: 'LEO', to: 'bob', quantity: '10' });
      const parsed = JSON.parse(json);
      expect(parsed.contractName).toBe('tokens');
      expect(parsed.contractAction).toBe('transfer');
      expect(parsed.contractPayload).toEqual({ symbol: 'LEO', to: 'bob', quantity: '10' });
    });
  });

  describe('buildTransferPayload', () => {
    it('builds correct transfer payload', () => {
      const json = buildTransferPayload('LEO', 'alice', '100.000', 'thanks');
      const parsed = JSON.parse(json);
      expect(parsed.contractName).toBe('tokens');
      expect(parsed.contractAction).toBe('transfer');
      expect(parsed.contractPayload.symbol).toBe('LEO');
      expect(parsed.contractPayload.to).toBe('alice');
      expect(parsed.contractPayload.quantity).toBe('100.000');
      expect(parsed.contractPayload.memo).toBe('thanks');
    });

    it('defaults memo to empty string', () => {
      const json = buildTransferPayload('BEE', 'bob', '5');
      const parsed = JSON.parse(json);
      expect(parsed.contractPayload.memo).toBe('');
    });
  });

  describe('buildStakePayload', () => {
    it('builds correct stake payload', () => {
      const json = buildStakePayload('LEO', 'alice', '50');
      const parsed = JSON.parse(json);
      expect(parsed.contractAction).toBe('stake');
      expect(parsed.contractPayload.to).toBe('alice');
      expect(parsed.contractPayload.symbol).toBe('LEO');
      expect(parsed.contractPayload.quantity).toBe('50');
    });
  });

  describe('buildUnstakePayload', () => {
    it('builds correct unstake payload', () => {
      const json = buildUnstakePayload('SPS', '25');
      const parsed = JSON.parse(json);
      expect(parsed.contractAction).toBe('unstake');
      expect(parsed.contractPayload.symbol).toBe('SPS');
      expect(parsed.contractPayload.quantity).toBe('25');
    });
  });

  describe('buildDelegatePayload', () => {
    it('builds correct delegate payload', () => {
      const json = buildDelegatePayload('LEO', 'bob', '100');
      const parsed = JSON.parse(json);
      expect(parsed.contractAction).toBe('delegate');
      expect(parsed.contractPayload.to).toBe('bob');
      expect(parsed.contractPayload.symbol).toBe('LEO');
    });
  });

  describe('buildUndelegatePayload', () => {
    it('builds correct undelegate payload', () => {
      const json = buildUndelegatePayload('LEO', 'bob', '50');
      const parsed = JSON.parse(json);
      expect(parsed.contractAction).toBe('undelegate');
      expect(parsed.contractPayload.from).toBe('bob');
    });
  });
});
