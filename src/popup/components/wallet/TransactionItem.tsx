import {
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Gift,
  PiggyBank,
  Users,
  RefreshCw,
  Star,
  Award,
  Coins,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react';
import type { TransactionRecord } from '@/core/types';
import { timeAgo } from '@/core/hive/operations';

interface TransactionItemProps {
  tx: TransactionRecord;
  currentUser: string;
}

interface TxDisplay {
  icon: typeof ArrowUpRight;
  label: string;
  color: string;
  iconBg: string;
}

function getTxDisplay(tx: TransactionRecord, currentUser: string): TxDisplay {
  const isIncoming = tx.to === currentUser && tx.from !== currentUser;

  switch (tx.type) {
    case 'transfer':
      return isIncoming
        ? { icon: ArrowDownLeft, label: 'Received', color: 'text-success', iconBg: 'bg-success/12' }
        : { icon: ArrowUpRight, label: 'Sent', color: 'text-hive', iconBg: 'bg-hive/12' };
    case 'transfer_to_vesting':
      return { icon: Zap, label: 'Power Up', color: 'text-warning', iconBg: 'bg-warning/12' };
    case 'withdraw_vesting':
      return { icon: Zap, label: 'Power Down', color: 'text-coral', iconBg: 'bg-coral/12' };
    case 'delegate_vesting_shares':
      return isIncoming
        ? { icon: Users, label: 'Delegation In', color: 'text-info', iconBg: 'bg-info/12' }
        : { icon: Users, label: 'Delegated', color: 'text-info', iconBg: 'bg-info/12' };
    case 'claim_reward_balance':
      return { icon: Gift, label: 'Claimed Rewards', color: 'text-success', iconBg: 'bg-success/12' };
    case 'transfer_to_savings':
      return { icon: PiggyBank, label: 'To Savings', color: 'text-info', iconBg: 'bg-info/12' };
    case 'transfer_from_savings':
      return { icon: PiggyBank, label: 'From Savings', color: 'text-info', iconBg: 'bg-info/12' };
    case 'curation_reward':
      return { icon: Star, label: 'Curation Reward', color: 'text-success', iconBg: 'bg-success/12' };
    case 'author_reward':
      return { icon: Award, label: 'Author Reward', color: 'text-success', iconBg: 'bg-success/12' };
    case 'producer_reward':
      return { icon: Award, label: 'Witness Reward', color: 'text-success', iconBg: 'bg-success/12' };
    case 'fill_convert_request':
      return { icon: RefreshCw, label: 'Conversion', color: 'text-text-secondary', iconBg: 'bg-surface-overlay' };
    case 'fill_order':
      return { icon: ShoppingCart, label: 'Order Filled', color: 'text-text-secondary', iconBg: 'bg-surface-overlay' };
    case 'he_transfer':
      return isIncoming
        ? { icon: ArrowDownLeft, label: 'Token Received', color: 'text-success', iconBg: 'bg-success/12' }
        : { icon: ArrowUpRight, label: 'Token Sent', color: 'text-hive', iconBg: 'bg-hive/12' };
    case 'he_stake':
      return { icon: Zap, label: 'Token Staked', color: 'text-warning', iconBg: 'bg-warning/12' };
    case 'he_unstake':
      return { icon: Zap, label: 'Token Unstaked', color: 'text-coral', iconBg: 'bg-coral/12' };
    case 'he_delegate':
      return { icon: Users, label: 'Token Delegated', color: 'text-info', iconBg: 'bg-info/12' };
    case 'he_undelegate':
      return { icon: Users, label: 'Token Undelegated', color: 'text-info', iconBg: 'bg-info/12' };
    case 'he_market_buy':
      return { icon: Coins, label: 'Market Buy', color: 'text-success', iconBg: 'bg-success/12' };
    case 'he_market_sell':
      return { icon: Coins, label: 'Market Sell', color: 'text-coral', iconBg: 'bg-coral/12' };
    case 'he_other':
      return { icon: Coins, label: 'Token Op', color: 'text-warning', iconBg: 'bg-warning/12' };
    default:
      return { icon: RefreshCw, label: tx.type.replace(/_/g, ' '), color: 'text-text-secondary', iconBg: 'bg-surface-overlay' };
  }
}

function getSubtitle(tx: TransactionRecord, currentUser: string): string {
  const isOutgoing = tx.from === currentUser && tx.to && tx.to !== currentUser;
  const otherUser = isOutgoing ? tx.to : (tx.from !== currentUser ? tx.from : tx.to);

  switch (tx.type) {
    case 'transfer':
    case 'he_transfer':
      return otherUser ? `@${otherUser}` : '';
    case 'he_delegate':
    case 'he_undelegate':
      return tx.to ? `@${tx.to}` : '';
    case 'delegate_vesting_shares':
      return otherUser ? `@${otherUser}` : '';
    default:
      return otherUser ? `@${otherUser}` : '';
  }
}

function getHiveHubUrl(tx: TransactionRecord): string | null {
  if (!tx.id || tx.id === '0000000000000000000000000000000000000000') return null;
  return `https://hub.peakd.com/tx/${tx.id}`;
}

export function TransactionItem({ tx, currentUser }: TransactionItemProps) {
  const display = getTxDisplay(tx, currentUser);
  const subtitle = getSubtitle(tx, currentUser);
  const Icon = display.icon;
  const hubUrl = getHiveHubUrl(tx);

  const isPositive =
    (tx.type === 'transfer' && tx.to === currentUser && tx.from !== currentUser) ||
    (tx.type === 'he_transfer' && tx.to === currentUser && tx.from !== currentUser) ||
    tx.type === 'claim_reward_balance' ||
    tx.type === 'curation_reward' ||
    tx.type === 'author_reward' ||
    tx.type === 'producer_reward' ||
    tx.type === 'he_market_buy';

  const isNegative =
    (tx.type === 'transfer' && tx.from === currentUser && tx.to !== currentUser) ||
    (tx.type === 'he_transfer' && tx.from === currentUser) ||
    tx.type === 'he_market_sell';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/30 last:border-b-0 group">
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${display.iconBg}`}>
        <Icon size={15} className={display.color} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-text-primary truncate">
          {display.label}
        </p>
        <p className="text-[11px] text-text-tertiary truncate">
          {subtitle || timeAgo(tx.timestamp)}
        </p>
      </div>

      {/* Amount + time + link */}
      <div className="text-right flex-shrink-0 flex items-center gap-2">
        <div>
          {tx.amount && (
            <p className={`text-[12px] font-bold truncate max-w-[110px] ${
              isPositive ? 'text-success' : isNegative ? 'text-hive' : 'text-text-primary'
            }`}>
              {isPositive ? '+' : isNegative ? '-' : ''}{tx.amount}
            </p>
          )}
          <p className="text-[10px] text-text-tertiary">{timeAgo(tx.timestamp)}</p>
        </div>

        {/* Hive Hub link */}
        {hubUrl && (
          <a
            href={hubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-hive hover:bg-hive/10 transition-all"
            title="View on Hive Hub"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
