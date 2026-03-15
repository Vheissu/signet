import { useState, useEffect } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { Header } from '@/popup/components/layout/Header';
import { BottomNav } from '@/popup/components/layout/BottomNav';
import { TransactionItem } from '@/popup/components/wallet/TransactionItem';
import { Spinner } from '@/popup/components/ui/Spinner';
import { useStore } from '@/popup/store';
import { getAccountHistory } from '@/core/hive/client';
import type { TransactionRecord } from '@/core/types';

const FILTERS: { key: string; label: string; types: string[] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'transfers', label: 'Transfers', types: ['transfer'] },
  { key: 'power', label: 'Power', types: ['transfer_to_vesting', 'withdraw_vesting'] },
  { key: 'delegation', label: 'Delegation', types: ['delegate_vesting_shares'] },
  { key: 'rewards', label: 'Rewards', types: ['claim_reward_balance', 'curation_reward', 'author_reward', 'producer_reward'] },
  { key: 'votes', label: 'Votes', types: ['vote', 'account_witness_vote'] },
  { key: 'savings', label: 'Savings', types: ['transfer_to_savings', 'transfer_from_savings'] },
  { key: 'social', label: 'Social', types: ['comment', 'custom_json'] },
];

export function History() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [activeAccountName]);

  async function loadHistory() {
    if (!activeAccountName) return;
    setLoading(true);

    try {
      const history = await getAccountHistory(activeAccountName, -1, 500);
      setTransactions(history);
    } catch (err) {
      console.error('Failed to load history:', err);
    }

    setLoading(false);
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadHistory();
    setIsRefreshing(false);
  };

  const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  const filteredTx = activeFilter.types.length === 0
    ? transactions
    : transactions.filter((tx) => activeFilter.types.includes(tx.type));

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <p className="text-xs font-bold text-text-secondary tracking-widest uppercase">
            History ({filteredTx.length})
          </p>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-elevated transition-colors"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors ${
                filter === f.key
                  ? 'bg-hive text-white'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : filteredTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
              <Clock size={28} className="mb-3 opacity-40" />
              <p className="text-sm font-medium">No transactions found</p>
              <p className="text-xs mt-1">
                {filter !== 'all' ? 'Try a different filter' : 'Transactions will appear here'}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredTx.map((tx, i) => (
                <TransactionItem
                  key={`${tx.id}-${tx.type}-${i}`}
                  tx={tx}
                  currentUser={activeAccountName || ''}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
