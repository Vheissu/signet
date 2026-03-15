import { useHive } from '@/popup/hooks/useHive';

export function BalanceCard() {
  const { balances, formatUsd, formatNumber, hivePriceUsd } = useHive();

  // Calculate a simple portfolio allocation for the ring
  const totalUsd = balances.totalUsd || 1;
  const hivePercent = Math.round(((balances.hiveUsd + balances.hpUsd) / totalUsd) * 100);
  const hbdPercent = 100 - hivePercent;

  return (
    <div className="rounded-2xl gradient-purple border border-border overflow-hidden p-5">
      <div className="flex items-center gap-4">
        {/* Portfolio ring */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            {/* Background ring */}
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="4"
            />
            {/* HIVE portion (red) */}
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke="#E31337"
              strokeWidth="4"
              strokeDasharray={`${hivePercent * 0.88} ${88 - hivePercent * 0.88}`}
              strokeLinecap="round"
            />
            {/* HBD portion (coral) */}
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke="#5CEAA0"
              strokeWidth="4"
              strokeDasharray={`${hbdPercent * 0.88} ${88 - hbdPercent * 0.88}`}
              strokeDashoffset={`-${hivePercent * 0.88}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-extrabold text-text-primary">
              {hivePercent}%
            </span>
          </div>
        </div>

        {/* Values */}
        <div className="flex-1">
          <p className="text-xs font-medium text-text-secondary mb-0.5">Portfolio Value</p>
          <p className="text-2xl font-extrabold text-text-primary tracking-tight animate-count">
            {formatUsd(balances.totalUsd)}
          </p>
          <div className="flex gap-4 mt-1.5">
            <div>
              <p className="text-[10px] text-text-tertiary">HIVE</p>
              <p className="text-xs font-bold text-text-primary">{formatNumber(balances.hive, 3)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary">HBD</p>
              <p className="text-xs font-bold text-text-primary">{formatNumber(balances.hbd, 3)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary">HP</p>
              <p className="text-xs font-bold text-text-primary">{formatNumber(balances.hp, 3)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
