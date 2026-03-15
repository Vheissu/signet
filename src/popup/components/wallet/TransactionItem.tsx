import {
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Gift,
  PiggyBank,
  Users,
  RefreshCw,
} from 'lucide-react';
import type { TransactionRecord } from '@/core/types';
import { timeAgo, parseAmount } from '@/core/hive/operations';

interface TransactionItemProps {
  tx: TransactionRecord;
  currentUser: string;
}

const txConfig: Record<
  string,
  { icon: typeof ArrowUpRight; label: string; color: string }
> = {
  transfer: {
    icon: ArrowUpRight,
    label: 'Transfer',
    color: 'text-hive',
  },
  transfer_to_vesting: {
    icon: Zap,
    label: 'Power Up',
    color: 'text-warning',
  },
  withdraw_vesting: {
    icon: Zap,
    label: 'Power Down',
    color: 'text-orange-400',
  },
  delegate_vesting_shares: {
    icon: Users,
    label: 'Delegation',
    color: 'text-purple-400',
  },
  claim_reward_balance: {
    icon: Gift,
    label: 'Claim Rewards',
    color: 'text-success',
  },
  transfer_to_savings: {
    icon: PiggyBank,
    label: 'To Savings',
    color: 'text-info',
  },
  transfer_from_savings: {
    icon: PiggyBank,
    label: 'From Savings',
    color: 'text-info',
  },
  fill_convert_request: {
    icon: RefreshCw,
    label: 'Conversion',
    color: 'text-text-secondary',
  },
  fill_order: {
    icon: RefreshCw,
    label: 'Order Filled',
    color: 'text-text-secondary',
  },
};

export function TransactionItem({ tx, currentUser }: TransactionItemProps) {
  const config = txConfig[tx.type] || {
    icon: RefreshCw,
    label: tx.type,
    color: 'text-text-secondary',
  };

  const Icon = config.icon;
  const isOutgoing = tx.from === currentUser && tx.type === 'transfer';
  const isIncoming = tx.to === currentUser && tx.type === 'transfer';
  const otherUser = isOutgoing ? tx.to : tx.from;

  // Use specific icons for incoming/outgoing transfers
  const DisplayIcon = isIncoming ? ArrowDownLeft : Icon;
  const displayColor = isIncoming ? 'text-success' : config.color;

  const { amount, currency } = tx.amount
    ? parseAmount(tx.amount)
    : { amount: 0, currency: '' };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${displayColor} bg-current/10`}
        style={{ backgroundColor: 'currentcolor', opacity: 0.1 }}
      >
        <DisplayIcon size={16} className={displayColor} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-text-primary truncate">
            {isIncoming ? 'Received' : isOutgoing ? 'Sent' : config.label}
          </span>
        </div>
        <p className="text-xs text-text-tertiary truncate">
          {otherUser ? `@${otherUser}` : timeAgo(tx.timestamp)}
        </p>
      </div>

      {/* Amount */}
      {amount > 0 && (
        <div className="text-right flex-shrink-0">
          <p
            className={`text-sm font-semibold ${
              isIncoming ? 'text-success' : isOutgoing ? 'text-text-primary' : 'text-text-primary'
            }`}
          >
            {isIncoming ? '+' : isOutgoing ? '-' : ''}
            {amount.toFixed(3)}
          </p>
          <p className="text-[10px] text-text-tertiary">{currency}</p>
        </div>
      )}
    </div>
  );
}
