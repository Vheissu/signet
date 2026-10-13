/**
 * Price history for HIVE/HBD (CoinGecko) and Hive Engine tokens (the
 * Hive Engine history API). Everything is real market data; when a source
 * is unavailable the caller gets null and should say so rather than draw
 * something made up.
 *
 * Responses are cached in extension storage so repeated popup opens do not
 * hammer the free CoinGecko tier.
 */

export interface PricePoint {
  time: number; // ms since epoch
  price: number;
}

export type PriceRange = '1h' | '24h' | '1w' | '1m' | '1y';

export const PRICE_RANGES: PriceRange[] = ['1h', '24h', '1w', '1m', '1y'];

const COINGECKO = 'https://api.coingecko.com/api/v3';
const HE_HISTORY = 'https://history.hive-engine.com/marketHistory';

const COIN_IDS: Record<string, string> = {
  HIVE: 'hive',
  HBD: 'hive_dollar',
};

const RANGE_DAYS: Record<PriceRange, number> = {
  '1h': 1,
  '24h': 1,
  '1w': 7,
  '1m': 30,
  '1y': 365,
};

// How long a cached series stays fresh
const CACHE_TTL: Record<PriceRange, number> = {
  '1h': 2 * 60_000,
  '24h': 5 * 60_000,
  '1w': 30 * 60_000,
  '1m': 60 * 60_000,
  '1y': 6 * 60 * 60_000,
};

const memoryCache = new Map<string, { at: number; points: PricePoint[] }>();

async function readCache(key: string): Promise<{ at: number; points: PricePoint[] } | null> {
  const mem = memoryCache.get(key);
  if (mem) return mem;
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const result = await chrome.storage.local.get(key);
      if (result[key]?.points) return result[key];
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeCache(key: string, points: PricePoint[]): Promise<void> {
  const entry = { at: Date.now(), points };
  memoryCache.set(key, entry);
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({ [key]: entry });
    }
  } catch {
    // ignore
  }
}

/**
 * Turn CoinGecko's [[ms, price], ...] into points, trimmed to the range.
 */
export function parseCoinGeckoSeries(raw: unknown, range: PriceRange, now = Date.now()): PricePoint[] {
  const prices = (raw as any)?.prices;
  if (!Array.isArray(prices)) return [];

  const points: PricePoint[] = prices
    .filter((p: any) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p: any) => ({ time: Number(p[0]), price: Number(p[1]) }))
    .sort((a: PricePoint, b: PricePoint) => a.time - b.time);

  if (range === '1h') {
    const cutoff = now - 60 * 60_000;
    const recent = points.filter((p) => p.time >= cutoff);
    // Always keep at least a dozen points so the line is drawable
    return recent.length >= 2 ? recent : points.slice(-12);
  }
  return points;
}

/**
 * Fetch USD price history for HIVE or HBD.
 * Returns null when the data cannot be fetched.
 */
export async function fetchPriceHistory(
  symbol: 'HIVE' | 'HBD',
  range: PriceRange,
  fetchImpl: typeof fetch = fetch
): Promise<PricePoint[] | null> {
  const coinId = COIN_IDS[symbol];
  if (!coinId) return null;

  const key = `price_history_${symbol}_${range}`;
  const cached = await readCache(key);
  if (cached && Date.now() - cached.at < CACHE_TTL[range]) {
    return cached.points;
  }

  try {
    const url = `${COINGECKO}/coins/${coinId}/market_chart?vs_currency=usd&days=${RANGE_DAYS[range]}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const points = parseCoinGeckoSeries(await response.json(), range);
    if (points.length < 2) throw new Error('Not enough data');
    await writeCache(key, points);
    return points;
  } catch {
    // A stale cache beats nothing
    return cached?.points ?? null;
  }
}

/**
 * Parse Hive Engine daily candles into close-price points (HIVE per token).
 */
export function parseHiveEngineSeries(raw: unknown): PricePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c: any) => c && Number.isFinite(Number(c.timestamp)) && Number.isFinite(parseFloat(c.closePrice)))
    .map((c: any) => ({ time: Number(c.timestamp) * 1000, price: parseFloat(c.closePrice) }))
    .sort((a, b) => a.time - b.time);
}

/**
 * Fetch daily price history for a Hive Engine token, priced in HIVE.
 * Returns null when unavailable. Tokens with no market have an empty array.
 */
export async function fetchTokenPriceHistory(
  symbol: string,
  days = 30,
  fetchImpl: typeof fetch = fetch
): Promise<PricePoint[] | null> {
  const key = `he_price_history_${symbol}_${days}`;
  const cached = await readCache(key);
  if (cached && Date.now() - cached.at < 60 * 60_000) {
    return cached.points;
  }

  try {
    const start = Math.floor(Date.now() / 1000) - days * 86_400;
    const url = `${HE_HISTORY}?symbol=${encodeURIComponent(symbol)}&timestampStart=${start}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const points = parseHiveEngineSeries(await response.json());
    await writeCache(key, points);
    return points;
  } catch {
    return cached?.points ?? null;
  }
}

/**
 * Percentage change from the first to the last point.
 */
export function percentChange(points: PricePoint[]): number {
  if (points.length < 2) return 0;
  const first = points[0].price;
  const last = points[points.length - 1].price;
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}
