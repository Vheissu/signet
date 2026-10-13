import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseCoinGeckoSeries,
  parseHiveEngineSeries,
  percentChange,
  fetchPriceHistory,
  fetchTokenPriceHistory,
} from './index';

const now = 1_700_000_000_000;

function mockFetch(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;
}

beforeEach(async () => {
  await (globalThis as any).chrome.storage.local.clear();
});

describe('parseCoinGeckoSeries', () => {
  it('converts and sorts price pairs', () => {
    const points = parseCoinGeckoSeries({ prices: [[now - 1000, 0.3], [now - 2000, 0.2]] }, '24h', now);
    expect(points).toEqual([
      { time: now - 2000, price: 0.2 },
      { time: now - 1000, price: 0.3 },
    ]);
  });

  it('drops malformed entries and handles missing data', () => {
    expect(parseCoinGeckoSeries({ prices: [[now, null], 'x', [now, 1]] }, '1w', now)).toEqual([{ time: now, price: 1 }]);
    expect(parseCoinGeckoSeries({}, '1w', now)).toEqual([]);
    expect(parseCoinGeckoSeries(null, '1w', now)).toEqual([]);
  });

  it('trims the 1h range to the last hour', () => {
    const prices = Array.from({ length: 24 }, (_, i) => [now - (23 - i) * 5 * 60_000, 1 + i]);
    const points = parseCoinGeckoSeries({ prices }, '1h', now);
    expect(points.length).toBe(13);
    expect(points[0].time).toBeGreaterThanOrEqual(now - 60 * 60_000);
  });
});

describe('parseHiveEngineSeries', () => {
  it('uses close prices and seconds timestamps, oldest first', () => {
    const points = parseHiveEngineSeries([
      { timestamp: 200, closePrice: '0.5' },
      { timestamp: 100, closePrice: '0.4' },
      { timestamp: 'bad', closePrice: '0.1' },
    ]);
    expect(points).toEqual([
      { time: 100_000, price: 0.4 },
      { time: 200_000, price: 0.5 },
    ]);
  });
});

describe('percentChange', () => {
  it('computes first-to-last change', () => {
    expect(percentChange([{ time: 1, price: 2 }, { time: 2, price: 3 }])).toBeCloseTo(50);
    expect(percentChange([{ time: 1, price: 2 }])).toBe(0);
    expect(percentChange([{ time: 1, price: 0 }, { time: 2, price: 3 }])).toBe(0);
  });
});

describe('fetchPriceHistory', () => {
  it('fetches, caches and reuses the cached series', async () => {
    const fetchImpl = mockFetch({ prices: [[now - 1000, 1], [now, 2]] });
    const first = await fetchPriceHistory('HIVE', '1w', fetchImpl);
    const second = await fetchPriceHistory('HIVE', '1w', fetchImpl);
    expect(first).toHaveLength(2);
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl as any).mock.calls[0][0]).toContain('coins/hive/market_chart');
  });

  it('returns null when the request fails and nothing is cached', async () => {
    expect(await fetchPriceHistory('HBD', '1y', mockFetch({}, false))).toBeNull();
  });

  it('returns null for a series with fewer than two points', async () => {
    expect(await fetchPriceHistory('HBD', '1m', mockFetch({ prices: [[now, 1]] }))).toBeNull();
  });
});

describe('fetchTokenPriceHistory', () => {
  it('returns an empty array for tokens without trades', async () => {
    expect(await fetchTokenPriceHistory('NOPE', 30, mockFetch([]))).toEqual([]);
  });

  it('returns null on failure', async () => {
    expect(await fetchTokenPriceHistory('FAIL', 30, mockFetch([], false))).toBeNull();
  });
});
