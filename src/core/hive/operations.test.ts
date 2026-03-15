import { describe, it, expect } from 'vitest';
import {
  parseAmount,
  formatAmount,
  formatNumber,
  formatUsd,
  timeAgo,
  hasPendingRewards,
  calculateVotingPower,
} from './operations';

describe('Hive Operations Utilities', () => {
  describe('parseAmount', () => {
    it('parses "1.234 HIVE" correctly', () => {
      const result = parseAmount('1.234 HIVE');
      expect(result.amount).toBeCloseTo(1.234);
      expect(result.currency).toBe('HIVE');
    });

    it('parses "0.001 HBD" correctly', () => {
      const result = parseAmount('0.001 HBD');
      expect(result.amount).toBeCloseTo(0.001);
      expect(result.currency).toBe('HBD');
    });

    it('parses "1000000.000000 VESTS"', () => {
      const result = parseAmount('1000000.000000 VESTS');
      expect(result.amount).toBeCloseTo(1000000);
      expect(result.currency).toBe('VESTS');
    });

    it('handles amounts with extra whitespace', () => {
      const result = parseAmount('  5.000 HIVE  ');
      expect(result.amount).toBeCloseTo(5);
      expect(result.currency).toBe('HIVE');
    });

    it('defaults currency to HIVE if missing', () => {
      const result = parseAmount('10.5');
      expect(result.amount).toBeCloseTo(10.5);
      expect(result.currency).toBe('HIVE');
    });
  });

  describe('formatAmount', () => {
    it('formats with default 3 decimal places', () => {
      expect(formatAmount(1.23456, 'HIVE')).toBe('1.235 HIVE');
    });

    it('formats with custom precision', () => {
      expect(formatAmount(1.23456789, 'VESTS', 6)).toBe('1.234568 VESTS');
    });

    it('formats zero', () => {
      expect(formatAmount(0, 'HBD')).toBe('0.000 HBD');
    });
  });

  describe('formatNumber', () => {
    it('formats with thousands separators', () => {
      expect(formatNumber(1234567.89)).toBe('1,234,567.89');
    });

    it('formats with custom decimal places', () => {
      expect(formatNumber(1.23456, 3)).toBe('1.235');
    });

    it('formats zero', () => {
      expect(formatNumber(0, 3)).toBe('0.000');
    });
  });

  describe('formatUsd', () => {
    it('formats as dollar amount', () => {
      expect(formatUsd(1234.56)).toBe('$1,234.56');
    });

    it('formats small amounts', () => {
      expect(formatUsd(0.01)).toBe('$0.01');
    });
  });

  describe('timeAgo', () => {
    it('returns "just now" for recent timestamps', () => {
      const now = new Date().toISOString().replace('Z', '');
      expect(timeAgo(now)).toBe('just now');
    });

    it('returns minutes for timestamps under an hour', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
        .toISOString()
        .replace('Z', '');
      expect(timeAgo(fiveMinAgo)).toBe('5m ago');
    });

    it('returns hours for timestamps under a day', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000)
        .toISOString()
        .replace('Z', '');
      expect(timeAgo(threeHoursAgo)).toBe('3h ago');
    });

    it('returns days for timestamps under a week', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000)
        .toISOString()
        .replace('Z', '');
      expect(timeAgo(twoDaysAgo)).toBe('2d ago');
    });
  });

  describe('hasPendingRewards', () => {
    it('returns true when hive rewards are pending', () => {
      const account = {
        reward_hive_balance: '1.000 HIVE',
        reward_hbd_balance: '0.000 HBD',
        reward_vesting_balance: '0.000000 VESTS',
      };
      expect(hasPendingRewards(account)).toBe(true);
    });

    it('returns true when HBD rewards are pending', () => {
      const account = {
        reward_hive_balance: '0.000 HIVE',
        reward_hbd_balance: '0.500 HBD',
        reward_vesting_balance: '0.000000 VESTS',
      };
      expect(hasPendingRewards(account)).toBe(true);
    });

    it('returns false when no rewards are pending', () => {
      const account = {
        reward_hive_balance: '0.000 HIVE',
        reward_hbd_balance: '0.000 HBD',
        reward_vesting_balance: '0.000000 VESTS',
      };
      expect(hasPendingRewards(account)).toBe(false);
    });
  });

  describe('calculateVotingPower', () => {
    it('returns 100% for a fully regenerated account', () => {
      const account = {
        voting_power: 10000,
        last_vote_time: new Date(Date.now() - 7 * 86400 * 1000).toISOString().replace('Z', ''),
      };
      const vp = calculateVotingPower(account);
      expect(vp).toBe(100);
    });

    it('returns less than 100% for a recently voted account', () => {
      const account = {
        voting_power: 5000,
        last_vote_time: new Date().toISOString().replace('Z', ''),
      };
      const vp = calculateVotingPower(account);
      expect(vp).toBeGreaterThanOrEqual(49);
      expect(vp).toBeLessThanOrEqual(51);
    });

    it('never exceeds 100%', () => {
      const account = {
        voting_power: 10000,
        last_vote_time: new Date(Date.now() - 30 * 86400 * 1000).toISOString().replace('Z', ''),
      };
      const vp = calculateVotingPower(account);
      expect(vp).toBe(100);
    });
  });
});
