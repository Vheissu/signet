import {
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Gift,
  PiggyBank,
  Users,
  RefreshCw,
  Vote,
  MessageSquare,
  Star,
  FileJson,
  Award,
} from 'lucide-react';
import type { TransactionRecord } from '@/core/types';
import { timeAgo } from '@/core/hive/operations';

interface TransactionItemProps {
  tx: TransactionRecord;
  currentUser: string;
}

const txConfig: Record<
  string,
  { icon: typeof ArrowUpRight; label: string; color: string }
> = {
  transfer: { icon: ArrowUpRight, label: 'Transfer', color: 'text-hive' },
  transfer_to_vesting: { icon: Zap, label: 'Power Up', color: 'text-warning' },
  withdraw_vesting: { icon: Zap, label: 'Power Down', color: 'text-coral' },
  delegate_vesting_shares: { icon: Users, label: 'Delegation', color: 'text-info' },
  claim_reward_balance: { icon: Gift, label: 'Claim Rewards', color: 'text-success' },
  transfer_to_savings: { icon: PiggyBank, label: 'To Savings', color: 'text-info' },
  transfer_from_savings: { icon: PiggyBank, label: 'From Savings', color: 'text-info' },
  fill_convert_request: { icon: RefreshCw, label: 'Conversion', color: 'text-text-secondary' },
  fill_order: { icon: RefreshCw, label: 'Order Filled', color: 'text-text-secondary' },
  vote: { icon: Vote, label: 'Vote', color: 'text-coral' },
  comment: { icon: MessageSquare, label: 'Comment', color: 'text-info' },
  custom_json: { icon: FileJson, label: 'Custom JSON', color: 'text-warning' },
  curation_reward: { icon: Star, label: 'Curation Reward', color: 'text-success' },
  author_reward: { icon: Award, label: 'Author Reward', color: 'text-success' },
  producer_reward: { icon: Award, label: 'Producer Reward', color: 'text-success' },
  account_witness_vote: { icon: Vote, label: 'Witness Vote', color: 'text-coral' },
};

export function TransactionItem({ tx, currentUser }: TransactionItemProps) {
  const config = txConfig[tx.type] || {
    icon: RefreshCw,
    label: tx.type.replace(/_/g, ' '),
    color: 'text-text-secondary',
  };

  const isOutgoing = tx.from === currentUser && tx.to && tx.to !== currentUser;
  const isIncoming = tx.to === currentUser && tx.from && tx.from !== currentUser;

  // Override for transfers
  const DisplayIcon = tx.type === 'transfer'
    ? (isIncoming ? ArrowDownLeft : ArrowUpRight)
    : config.icon;
  const displayColor = tx.type === 'transfer'
    ? (isIncoming ? 'text-success' : 'text-hive')
    : config.color;

  const otherUser = isOutgoing ? tx.to : (tx.from !== currentUser ? tx.from : tx.to);

  // Build subtitle
  let subtitle = '';
  if (otherUser) {
    subtitle = `@${otherUser}`;
  } else {
    subtitle = timeAgo(tx.timestamp);
  }

  // For custom_json, show the operation id
  if (tx.type === 'custom_json' && tx.memo) {
    subtitle = tx.memo;
    if (tx.to) subtitle += ` -> @${tx.to}`;
  }

  // For votes, show the target
  if (tx.type === 'vote' && tx.to) {
    subtitle = `@${tx.to}`;
    if (tx.memo) subtitle += `/${tx.memo}`;
  }

  // For comments
  if (tx.type === 'comment') {
    subtitle = tx.memo ? `/${tx.memo}` : '';
    if (tx.to) subtitle = `Reply to @${tx.to}`;
  }

  // Display label
  let displayLabel = config.label;
  if (tx.type === 'transfer') {
    displayLabel = isIncoming ? 'Received' : isOutgoing ? 'Sent' : 'Transfer';
  }

  // Format amount for display
  const amountDisplay = tx.amount || '';
  const isPositive = isIncoming || tx.type === 'claim_reward_balance' ||
    tx.type === 'curation_reward' || tx.type === 'author_reward' || tx.type === 'producer_reward';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/30 last:border-b-0">
      {/* Icon */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${displayColor} bg-surface-elevated`}>
        <DisplayIcon size={14} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">
          {displayLabel}
        </p>
        <p className="text-[11px] text-text-tertiary truncate">
          {subtitle || timeAgo(tx.timestamp)}
        </p>
      </div>

      {/* Amount & time */}
      <div className="text-right flex-shrink-0 max-w-[120px]">
        {amountDisplay && (
          <p className={`text-xs font-bold truncate ${
            isPositive ? 'text-success' : 'text-text-primary'
          }`}>
            {isPositive ? '+' : isOutgoing ? '-' : ''}{amountDisplay}
          </p>
        )}
        <p className="text-[10px] text-text-tertiary">{timeAgo(tx.timestamp)}</p>
      </div>
    </div>
  );
}
