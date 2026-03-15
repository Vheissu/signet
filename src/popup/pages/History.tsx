import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Header } from '@/popup/components/layout/Header';
import { BottomNav } from '@/popup/components/layout/BottomNav';
import { TransactionItem } from '@/popup/components/wallet/TransactionItem';
import { Spinner } from '@/popup/components/ui/Spinner';
import { useStore } from '@/popup/store';
import { getAccountHistory } from '@/core/hive/client';
import type { TransactionRecord } from '@/core/types';

export function History() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadHistory();
  }, [activeAccountName]);

  async function loadHistory() {
    if (!activeAccountName) return;
    setLoading(true);

    try {
      const history = await getAccountHistory(activeAccountName, -1, 100);
      setTransactions(history);
    } catch (err) {
      console.error('Failed to load history:', err);
    }

    setLoading(false);
  }

  const filters = ['all', 'transfer', 'power', 'delegation', 'rewards'];

  const filteredTx = transactions.filter((tx) => {
    if (filter === 'all') return true;
    if (filter === 'transfer') return tx.type === 'transfer';
    if (filter === 'power')
      return tx.type === 'transfer_to_vesting' || tx.type === 'withdraw_vesting';
    if (filter === 'delegation') return tx.type === 'delegate_vesting_shares';
    if (filter === 'rewards') return tx.type === 'claim_reward_balance';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Filter pills */}
        <div className="flex gap-1.5 px-4 py-3 overflow-x-auto border-b border-border">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-hive text-white'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
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
              <Clock size={32} className="mb-3 opacity-40" />
              <p className="text-sm">No transactions found</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredTx.map((tx) => (
                <TransactionItem
                  key={`${tx.id}-${tx.type}-${tx.timestamp}`}
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
