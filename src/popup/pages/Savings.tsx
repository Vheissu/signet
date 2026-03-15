import { useState } from 'react';
import { PiggyBank, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Input } from '@/popup/components/ui/Input';
import { Button } from '@/popup/components/ui/Button';
import { Card } from '@/popup/components/ui/Card';
import { Badge } from '@/popup/components/ui/Badge';
import { useStore } from '@/popup/store';
import { useHive } from '@/popup/hooks/useHive';
import { useAccounts } from '@/popup/hooks/useAccounts';
import { broadcastTransferToSavings, broadcastTransferFromSavings } from '@/core/hive/client';

type SavingsTab = 'deposit' | 'withdraw';

export function Savings() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const addToast = useStore((s) => s.addToast);
  const goBack = useStore((s) => s.goBack);
  const { balances, formatNumber, refreshAccountData } = useHive();
  const { getDecryptedKey } = useAccounts();

  const [tab, setTab] = useState<SavingsTab>('deposit');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'HIVE' | 'HBD'>('HIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxDeposit = currency === 'HIVE' ? balances.hive : balances.hbd;
  const maxWithdraw = currency === 'HIVE' ? balances.savingsHive : balances.savingsHbd;
  const max = tab === 'deposit' ? maxDeposit : maxWithdraw;

  const handleSubmit = async () => {
    if (!activeAccountName) return;
    setIsSubmitting(true);

    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Active key required', 'error');
        setIsSubmitting(false);
        return;
      }

      const amountStr = `${parseFloat(amount).toFixed(3)} ${currency}`;

      if (tab === 'deposit') {
        await broadcastTransferToSavings(activeAccountName, activeAccountName, amountStr, '', activeKey);
        addToast(`Deposited ${amountStr} to savings`, 'success');
      } else {
        const requestId = Math.floor(Math.random() * 2 ** 32);
        await broadcastTransferFromSavings(
          activeAccountName,
          requestId,
          activeAccountName,
          amountStr,
          '',
          activeKey
        );
        addToast(`Withdrawal of ${amountStr} initiated (3 day cooldown)`, 'success');
      }

      await refreshAccountData();
      goBack();
    } catch (err: any) {
      addToast(err.message || 'Operation failed', 'error');
    }

    setIsSubmitting(false);
  };

  return (
    <PageContainer title="Savings" showBack>
      <div className="space-y-4">
        {/* Tab switcher */}
        <div className="flex bg-surface-elevated rounded-xl p-1">
          <button
            onClick={() => { setTab('deposit'); setAmount(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'deposit'
                ? 'bg-hive text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <ArrowDownLeft size={14} />
            Deposit
          </button>
          <button
            onClick={() => { setTab('withdraw'); setAmount(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'withdraw'
                ? 'bg-hive text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <ArrowUpRight size={14} />
            Withdraw
          </button>
        </div>

        {/* Savings balances */}
        <div className="grid grid-cols-2 gap-3">
          <Card variant="elevated" padding="sm">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">HIVE Savings</p>
            <p className="text-base font-bold text-text-primary mt-0.5">
              {formatNumber(balances.savingsHive, 3)}
            </p>
          </Card>
          <Card variant="elevated" padding="sm">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">HBD Savings</p>
            <p className="text-base font-bold text-text-primary mt-0.5">
              {formatNumber(balances.savingsHbd, 3)}
            </p>
            <Badge variant="success" className="mt-1">20% APR</Badge>
          </Card>
        </div>

        {/* Amount */}
        <div>
          <Input
            label={tab === 'deposit' ? 'Amount to Deposit' : 'Amount to Withdraw'}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.000"
            step="0.001"
            rightElement={
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'HIVE' | 'HBD')}
                className="bg-transparent text-xs font-bold text-hive border-none outline-none cursor-pointer"
              >
                <option value="HIVE">HIVE</option>
                <option value="HBD">HBD</option>
              </select>
            }
          />
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[11px] text-text-tertiary">
              Available: {formatNumber(max, 3)} {currency}
            </span>
            <button
              onClick={() => setAmount(max.toFixed(3))}
              className="text-[11px] font-semibold text-hive hover:text-hive-light"
            >
              MAX
            </button>
          </div>
        </div>

        {tab === 'withdraw' && (
          <Card variant="outline" padding="sm">
            <p className="text-xs text-text-secondary leading-relaxed">
              Savings withdrawals have a <strong className="text-text-primary">3-day</strong> cooldown
              period for security.
            </p>
          </Card>
        )}

        {tab === 'deposit' && currency === 'HBD' && (
          <Card variant="outline" padding="sm">
            <p className="text-xs text-text-secondary leading-relaxed">
              HBD in savings earns <strong className="text-success">20% APR</strong> interest,
              paid monthly by the blockchain.
            </p>
          </Card>
        )}

        <Button
          fullWidth
          size="lg"
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={!amount || parseFloat(amount) <= 0}
          icon={<PiggyBank size={16} />}
        >
          {tab === 'deposit' ? 'Deposit to Savings' : 'Withdraw from Savings'}
        </Button>
      </div>
    </PageContainer>
  );
}
