import { useHive } from '@/popup/hooks/useHive';
import { PiggyBank } from 'lucide-react';

interface TokenDisplayItem {
  symbol: string;
  name: string;
  balance: number;
  usd: number;
  color: string;
  icon: string;
}

export function TokenList() {
  const { balances, formatNumber, formatUsd } = useHive();

  const tokens: TokenDisplayItem[] = [
    {
      symbol: 'HIVE',
      name: 'Hive',
      balance: balances.hive,
      usd: balances.hiveUsd,
      color: 'bg-hive',
      icon: 'H',
    },
    {
      symbol: 'HBD',
      name: 'Hive Backed Dollar',
      balance: balances.hbd,
      usd: balances.hbdUsd,
      color: 'bg-success',
      icon: '$',
    },
    {
      symbol: 'HP',
      name: 'Hive Power',
      balance: balances.hp,
      usd: balances.hpUsd,
      color: 'bg-info',
      icon: 'Z',
    },
  ];

  // Add savings if non-zero
  if (balances.savingsHive > 0 || balances.savingsHbd > 0) {
    if (balances.savingsHive > 0) {
      tokens.push({
        symbol: 'HIVE (Savings)',
        name: 'Savings',
        balance: balances.savingsHive,
        usd: balances.savingsHive * (balances.hiveUsd / (balances.hive || 1)),
        color: 'bg-warning',
        icon: 'S',
      });
    }
    if (balances.savingsHbd > 0) {
      tokens.push({
        symbol: 'HBD (Savings)',
        name: 'Savings',
        balance: balances.savingsHbd,
        usd: balances.savingsHbd,
        color: 'bg-warning',
        icon: 'S',
      });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-bold text-text-secondary tracking-wider uppercase">
          Assets
        </h3>
      </div>
      <div className="space-y-1">
        {tokens.map((token) => (
          <div
            key={token.symbol}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-elevated transition-colors"
          >
            {/* Token icon */}
            <div
              className={`w-8 h-8 rounded-lg ${token.color} flex items-center justify-center`}
            >
              {token.icon === 'S' ? (
                <PiggyBank size={14} className="text-white" />
              ) : (
                <span className="text-xs font-bold text-white">{token.icon}</span>
              )}
            </div>

            {/* Token info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{token.symbol}</p>
              <p className="text-[10px] text-text-tertiary">{token.name}</p>
            </div>

            {/* Balance */}
            <div className="text-right">
              <p className="text-sm font-semibold text-text-primary">
                {formatNumber(token.balance, 3)}
              </p>
              <p className="text-[10px] text-text-tertiary">{formatUsd(token.usd)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
