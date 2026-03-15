import { useState, useEffect } from 'react';
import { Search, Coins } from 'lucide-react';
import { Header } from '@/popup/components/layout/Header';
import { BottomNav } from '@/popup/components/layout/BottomNav';
import { Spinner } from '@/popup/components/ui/Spinner';
import { useStore } from '@/popup/store';
import { getFullTokenData, type HEBalance, type HEToken } from '@/core/hive-engine/api';

interface TokenRow {
  balance: HEBalance;
  token: HEToken | null;
  price: number;
  valueHive: number;
}

export function Tokens() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const navigateTo = useStore((s) => s.navigateTo);
  const hivePriceUsd = useStore((s) => s.hivePriceUsd);

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTokens();
  }, [activeAccountName]);

  async function loadTokens() {
    if (!activeAccountName) return;
    setLoading(true);
    try {
      const data = await getFullTokenData(activeAccountName);
      setTokens(data);
    } catch (err) {
      console.error('Failed to load HE tokens:', err);
    }
    setLoading(false);
  }

  const filtered = tokens.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.balance.symbol.toLowerCase().includes(q) ||
      (t.token?.name || '').toLowerCase().includes(q)
    );
  });

  const totalValueUsd = tokens.reduce(
    (sum, t) => sum + t.valueHive * hivePriceUsd,
    0
  );

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Price ticker */}
        {!loading && tokens.length > 0 && (
          <div className="border-b border-border overflow-hidden">
            <div className="flex gap-4 px-4 py-2 overflow-x-auto no-scrollbar">
              {tokens.slice(0, 10).map((t) => {
                const price = t.price;
                return (
                  <button
                    key={t.balance.symbol}
                    onClick={() =>
                      navigateTo('tokenDetail' as any, {
                        symbol: t.balance.symbol,
                        tokenData: t,
                      })
                    }
                    className="flex items-center gap-2 flex-shrink-0 px-2.5 py-1.5 rounded-xl hover:bg-surface-elevated transition-colors"
                  >
                    <span className="text-[11px] font-bold text-text-primary">{t.balance.symbol}</span>
                    <span className="text-[11px] font-semibold text-text-tertiary">
                      {price > 0 ? price.toFixed(price < 0.01 ? 6 : 4) : '---'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary bar */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-text-secondary font-medium">Hive Engine Tokens</p>
              <p className="text-xl font-extrabold text-text-primary">
                ${totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-tertiary">{tokens.length} tokens</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens..."
              className="w-full h-10 bg-surface-elevated border border-border rounded-xl pl-9 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-hive/50"
            />
          </div>
        </div>

        {/* Token list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
              <Coins size={32} className="mb-3 opacity-40" />
              <p className="text-sm">
                {search ? 'No tokens match your search' : 'No Hive Engine tokens found'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((t) => {
                const liquid = parseFloat(t.balance.balance);
                const staked = parseFloat(t.balance.stake || '0');
                const total = liquid + staked;
                const usdValue = t.valueHive * hivePriceUsd;
                const icon = t.token?.metadata?.icon;

                return (
                  <button
                    key={t.balance.symbol}
                    onClick={() =>
                      navigateTo('tokenDetail' as any, {
                        symbol: t.balance.symbol,
                        tokenData: t,
                      })
                    }
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-surface-elevated transition-colors text-left"
                  >
                    {/* Token icon */}
                    <div className="w-9 h-9 rounded-xl bg-surface-overlay flex items-center justify-center overflow-hidden flex-shrink-0">
                      {icon ? (
                        <img
                          src={icon}
                          alt={t.balance.symbol}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-text-secondary">
                          {t.balance.symbol.slice(0, 3)}
                        </span>
                      )}
                    </div>

                    {/* Name & symbol */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {t.balance.symbol}
                      </p>
                      <p className="text-[10px] text-text-tertiary truncate">
                        {t.token?.name || t.balance.symbol}
                      </p>
                    </div>

                    {/* Balance & value */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-text-primary">
                        {total.toLocaleString('en-US', { maximumFractionDigits: 3 })}
                      </p>
                      {usdValue > 0.001 && (
                        <p className="text-[10px] text-text-tertiary">
                          ${usdValue.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
