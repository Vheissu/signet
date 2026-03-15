import { useState, useEffect } from 'react';
import { Users, Plus } from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Input } from '@/popup/components/ui/Input';
import { Button } from '@/popup/components/ui/Button';
import { Card } from '@/popup/components/ui/Card';
import { Spinner } from '@/popup/components/ui/Spinner';
import { useStore } from '@/popup/store';
import { useHive } from '@/popup/hooks/useHive';
import { useAccounts } from '@/popup/hooks/useAccounts';
import {
  getVestingDelegations,
  broadcastDelegateVestingShares,
  getAccount,
} from '@/core/hive/client';
import { vestsToHP, hpToVests, formatAmount, parseAmount } from '@/core/hive/operations';
import type { DelegationInfo } from '@/core/types';

export function Delegation() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const addToast = useStore((s) => s.addToast);
  const { balances, formatNumber, globalProperties, refreshAccountData } = useHive();
  const { getDecryptedKey } = useAccounts();

  const [delegations, setDelegations] = useState<DelegationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [delegatee, setDelegatee] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadDelegations();
  }, [activeAccountName]);

  async function loadDelegations() {
    if (!activeAccountName) return;
    setLoading(true);
    try {
      const result = await getVestingDelegations(activeAccountName);
      setDelegations(result);
    } catch (err) {
      console.error('Failed to load delegations:', err);
    }
    setLoading(false);
  }

  const handleDelegate = async () => {
    if (!activeAccountName || !globalProperties) return;
    setIsSubmitting(true);

    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Active key required', 'error');
        setIsSubmitting(false);
        return;
      }

      const clean = delegatee.replace('@', '').trim().toLowerCase();

      // Verify account exists
      const account = await getAccount(clean);
      if (!account) {
        addToast('Account not found', 'error');
        setIsSubmitting(false);
        return;
      }

      const vests = hpToVests(parseFloat(amount), globalProperties);
      const vestsStr = formatAmount(vests, 'VESTS', 6);

      await broadcastDelegateVestingShares(activeAccountName, clean, vestsStr, activeKey);

      addToast(`Delegated ${parseFloat(amount).toFixed(3)} HP to @${clean}`, 'success');
      setDelegatee('');
      setAmount('');
      setShowForm(false);
      await Promise.all([loadDelegations(), refreshAccountData()]);
    } catch (err: any) {
      addToast(err.message || 'Delegation failed', 'error');
    }

    setIsSubmitting(false);
  };

  const handleUndelegate = async (delegateeUser: string) => {
    if (!activeAccountName) return;

    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Active key required', 'error');
        return;
      }

      await broadcastDelegateVestingShares(
        activeAccountName,
        delegateeUser,
        '0.000000 VESTS',
        activeKey
      );

      addToast(`Undelegated from @${delegateeUser}`, 'success');
      await Promise.all([loadDelegations(), refreshAccountData()]);
    } catch (err: any) {
      addToast(err.message || 'Undelegation failed', 'error');
    }
  };

  return (
    <PageContainer
      title="Delegations"
      showBack
      headerRight={
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1.5 rounded-lg text-hive hover:bg-hive/10 transition-colors"
        >
          <Plus size={18} />
        </button>
      }
    >
      <div className="space-y-4">
        {/* Available HP */}
        <Card variant="gradient" padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                Available HP
              </p>
              <p className="text-lg font-bold text-text-primary">
                {formatNumber(balances.hp, 3)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                Delegated Out
              </p>
              <p className="text-lg font-bold text-hive">
                {globalProperties
                  ? formatNumber(
                      vestsToHP(balances.delegatedVests, globalProperties),
                      3
                    )
                  : '0.000'}
              </p>
            </div>
          </div>
        </Card>

        {/* New delegation form */}
        {showForm && (
          <Card variant="elevated" padding="md">
            <h4 className="text-sm font-semibold text-text-primary mb-3">
              New Delegation
            </h4>
            <div className="space-y-3">
              <Input
                label="Delegatee"
                value={delegatee}
                onChange={(e) => setDelegatee(e.target.value)}
                placeholder="Username"
                icon={<span className="text-text-tertiary font-bold text-sm">@</span>}
              />
              <Input
                label="Amount (HP)"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.000"
                rightElement={
                  <span className="text-xs font-bold text-hive">HP</span>
                }
              />
              <Button
                fullWidth
                onClick={handleDelegate}
                loading={isSubmitting}
                disabled={!delegatee || !amount || parseFloat(amount) <= 0}
              >
                Delegate
              </Button>
            </div>
          </Card>
        )}

        {/* Active delegations */}
        <div>
          <h3 className="text-xs font-bold text-text-secondary tracking-wider uppercase mb-2">
            Active Delegations ({delegations.length})
          </h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : delegations.length === 0 ? (
            <Card variant="elevated" padding="md">
              <div className="text-center py-4">
                <Users size={24} className="text-text-tertiary mx-auto mb-2" />
                <p className="text-sm text-text-secondary">No active delegations</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForm(true)}
                  className="mt-2"
                >
                  Create one
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {delegations.map((d) => (
                <Card key={d.delegatee} variant="elevated" padding="sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        @{d.delegatee}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {globalProperties
                          ? `${formatNumber(
                              vestsToHP(
                                parseAmount(d.vesting_shares).amount,
                                globalProperties
                              ),
                              3
                            )} HP`
                          : d.vesting_shares}
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleUndelegate(d.delegatee)}
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
