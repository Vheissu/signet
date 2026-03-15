import { useState } from 'react';
import { Zap, TrendingDown } from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Input } from '@/popup/components/ui/Input';
import { Button } from '@/popup/components/ui/Button';
import { Card } from '@/popup/components/ui/Card';
import { Badge } from '@/popup/components/ui/Badge';
import { useStore } from '@/popup/store';
import { useHive } from '@/popup/hooks/useHive';
import { useAccounts } from '@/popup/hooks/useAccounts';
import { broadcastTransferToVesting, broadcastWithdrawVesting } from '@/core/hive/client';
import { hpToVests, formatAmount } from '@/core/hive/operations';

type StakingTab = 'powerUp' | 'powerDown';

export function Staking() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const addToast = useStore((s) => s.addToast);
  const goBack = useStore((s) => s.goBack);
  const { balances, formatNumber, globalProperties, refreshAccountData } = useHive();
  const { getDecryptedKey } = useAccounts();

  const [tab, setTab] = useState<StakingTab>('powerUp');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePowerUp = async () => {
    if (!activeAccountName) return;
    setIsSubmitting(true);

    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Active key required', 'error');
        setIsSubmitting(false);
        return;
      }

      const amountStr = `${parseFloat(amount).toFixed(3)} HIVE`;
      await broadcastTransferToVesting(activeAccountName, activeAccountName, amountStr, activeKey);

      addToast(`Powered up ${amountStr}!`, 'success');
      await refreshAccountData();
      goBack();
    } catch (err: any) {
      addToast(err.message || 'Power up failed', 'error');
    }

    setIsSubmitting(false);
  };

  const handlePowerDown = async () => {
    if (!activeAccountName || !globalProperties) return;
    setIsSubmitting(true);

    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Active key required', 'error');
        setIsSubmitting(false);
        return;
      }

      const vests = hpToVests(parseFloat(amount), globalProperties);
      const vestsStr = formatAmount(vests, 'VESTS', 6);
      await broadcastWithdrawVesting(activeAccountName, vestsStr, activeKey);

      addToast(`Power down initiated for ${parseFloat(amount).toFixed(3)} HP`, 'success');
      await refreshAccountData();
      goBack();
    } catch (err: any) {
      addToast(err.message || 'Power down failed', 'error');
    }

    setIsSubmitting(false);
  };

  return (
    <PageContainer title="Staking" showBack>
      <div className="space-y-4">
        {/* Tab switcher */}
        <div className="flex bg-surface-elevated rounded-xl p-1">
          <button
            onClick={() => { setTab('powerUp'); setAmount(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'powerUp'
                ? 'bg-hive text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Zap size={14} />
            Power Up
          </button>
          <button
            onClick={() => { setTab('powerDown'); setAmount(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'powerDown'
                ? 'bg-hive text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <TrendingDown size={14} />
            Power Down
          </button>
        </div>

        {/* Current balances */}
        <div className="grid grid-cols-2 gap-3">
          <Card variant="elevated" padding="sm">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Available HIVE</p>
            <p className="text-base font-bold text-text-primary mt-0.5">
              {formatNumber(balances.hive, 3)}
            </p>
          </Card>
          <Card variant="elevated" padding="sm">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Hive Power</p>
            <p className="text-base font-bold text-text-primary mt-0.5">
              {formatNumber(balances.hp, 3)}
            </p>
          </Card>
        </div>

        {/* Amount input */}
        <div>
          <Input
            label={tab === 'powerUp' ? 'Amount to Power Up' : 'HP to Power Down'}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.000"
            step="0.001"
            min="0.001"
            rightElement={
              <span className="text-xs font-bold text-hive">
                {tab === 'powerUp' ? 'HIVE' : 'HP'}
              </span>
            }
          />
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[11px] text-text-tertiary">
              Max: {formatNumber(tab === 'powerUp' ? balances.hive : balances.hp, 3)}
            </span>
            <button
              onClick={() =>
                setAmount(
                  (tab === 'powerUp' ? balances.hive : balances.hp).toFixed(3)
                )
              }
              className="text-[11px] font-semibold text-hive hover:text-hive-light"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Info */}
        {tab === 'powerDown' && (
          <Card variant="outline" padding="sm">
            <p className="text-xs text-text-secondary leading-relaxed">
              Power Down converts HP back to liquid HIVE over <strong className="text-text-primary">13 weeks</strong>.
              You'll receive equal payments weekly.
            </p>
          </Card>
        )}

        {tab === 'powerUp' && (
          <Card variant="outline" padding="sm">
            <p className="text-xs text-text-secondary leading-relaxed">
              Power Up converts HIVE to Hive Power, increasing your influence
              on the network. HP provides <strong className="text-text-primary">voting weight</strong> and
              earns <Badge variant="success" className="mx-0.5">~3% APR</Badge>
            </p>
          </Card>
        )}

        <Button
          fullWidth
          size="lg"
          onClick={tab === 'powerUp' ? handlePowerUp : handlePowerDown}
          loading={isSubmitting}
          disabled={!amount || parseFloat(amount) <= 0}
          icon={tab === 'powerUp' ? <Zap size={16} /> : <TrendingDown size={16} />}
        >
          {tab === 'powerUp' ? 'Power Up' : 'Start Power Down'}
        </Button>
      </div>
    </PageContainer>
  );
}
