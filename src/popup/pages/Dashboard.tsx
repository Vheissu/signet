import { Gift, Fingerprint, X } from 'lucide-react';
import { Header } from '@/popup/components/layout/Header';
import { BottomNav } from '@/popup/components/layout/BottomNav';
import { BalanceCard } from '@/popup/components/wallet/BalanceCard';
import { PriceChart } from '@/popup/components/wallet/PriceChart';
import { ActionButtons } from '@/popup/components/wallet/ActionButtons';
import { ResourceBar } from '@/popup/components/wallet/ResourceBar';
import { Button } from '@/popup/components/ui/Button';
import { useStore } from '@/popup/store';
import { useHive } from '@/popup/hooks/useHive';
import { broadcastClaimRewards } from '@/core/hive/client';
import { useAccounts } from '@/popup/hooks/useAccounts';
import { useState, useEffect } from 'react';
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  enrollBiometric,
} from '@/core/biometric/webauthn';

export function Dashboard() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const activeAccountData = useStore((s) => s.activeAccountData);
  const password = useStore((s) => s.password);
  const addToast = useStore((s) => s.addToast);
  const { rewards, refreshAccountData, hivePriceUsd } = useHive();
  const { getDecryptedKey } = useAccounts();
  const [isClaiming, setIsClaiming] = useState(false);

  // Biometric enrollment prompt
  const [showBioPrompt, setShowBioPrompt] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    checkBiometricPrompt();
  }, []);

  async function checkBiometricPrompt() {
    try {
      const available = await isBiometricAvailable();
      if (!available) return;
      const enrolled = await isBiometricEnrolled();
      if (enrolled) return;
      if (typeof chrome !== 'undefined' && chrome?.storage) {
        const result = await chrome.storage.local.get('biometric_dismissed');
        if (result.biometric_dismissed) return;
      }
      setShowBioPrompt(true);
    } catch {}
  }

  const handleEnrollBiometric = async () => {
    if (!password) return;
    setIsEnrolling(true);
    const success = await enrollBiometric(password);
    addToast(success ? 'Fingerprint unlock enabled' : 'Could not enable fingerprint unlock', success ? 'success' : 'error');
    setShowBioPrompt(false);
    setIsEnrolling(false);
  };

  const handleDismissBioPrompt = async () => {
    setShowBioPrompt(false);
    try {
      if (typeof chrome !== 'undefined' && chrome?.storage) {
        await chrome.storage.local.set({ biometric_dismissed: true });
      }
    } catch {}
  };

  const handleClaimRewards = async () => {
    if (!activeAccountName || !activeAccountData) return;
    setIsClaiming(true);
    try {
      const postingKey = await getDecryptedKey('posting');
      if (!postingKey) {
        addToast('Posting key required to claim rewards', 'error');
        setIsClaiming(false);
        return;
      }
      await broadcastClaimRewards(
        activeAccountName,
        activeAccountData.reward_hive_balance as any,
        activeAccountData.reward_hbd_balance as any,
        activeAccountData.reward_vesting_balance as any,
        postingKey
      );
      addToast('Rewards claimed successfully!', 'success');
      await refreshAccountData();
    } catch (err: any) {
      addToast(err.message || 'Failed to claim rewards', 'error');
    }
    setIsClaiming(false);
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4">
          {/* Biometric prompt */}
          {showBioPrompt && (
            <div className="flex items-center gap-3 bg-surface-elevated border border-hive/15 rounded-2xl px-4 py-3 animate-fade-in">
              <div className="w-9 h-9 rounded-xl bg-hive/12 flex items-center justify-center flex-shrink-0">
                <Fingerprint size={18} className="text-hive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-text-primary">Enable Fingerprint Unlock?</p>
                <p className="text-[10px] text-text-tertiary">Use Touch ID to unlock faster</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button size="sm" onClick={handleEnrollBiometric} loading={isEnrolling}>
                  Enable
                </Button>
                <button onClick={handleDismissBioPrompt} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-overlay transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* 1. Portfolio balance — always visible at top */}
          <BalanceCard />

          {/* 2. Quick actions — always visible, no scrolling needed */}
          <ActionButtons />

          {/* 3. Claim rewards banner */}
          {rewards.hasPending && (
            <div className="flex items-center justify-between bg-success/8 border border-success/15 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-success/12 flex items-center justify-center">
                  <Gift size={16} className="text-success" />
                </div>
                <div>
                  <p className="text-xs font-bold text-text-primary">Rewards Available</p>
                  <p className="text-[10px] text-text-tertiary">
                    {rewards.hive > 0 && `${rewards.hive.toFixed(3)} HIVE `}
                    {rewards.hbd > 0 && `${rewards.hbd.toFixed(3)} HBD `}
                    {rewards.hp > 0 && `${rewards.hp.toFixed(6)} VESTS`}
                  </p>
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={handleClaimRewards} loading={isClaiming}>
                Claim
              </Button>
            </div>
          )}

          {/* 4. Resources */}
          <ResourceBar />

          {/* 5. Price chart — nice to have, can scroll to it */}
          <PriceChart currentPrice={hivePriceUsd} symbol="HIVE" />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
