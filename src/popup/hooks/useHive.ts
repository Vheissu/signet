import { useMemo } from 'react';
import { useStore } from '@/popup/store';
import {
  parseAmount,
  vestsToHP,
  calculateAccountValue,
  formatNumber,
  formatUsd,
  hasPendingRewards,
} from '@/core/hive/operations';

export function useHive() {
  const activeAccountData = useStore((s) => s.activeAccountData);
  const globalProperties = useStore((s) => s.globalProperties);
  const hivePriceUsd = useStore((s) => s.hivePriceUsd);
  const hbdPriceUsd = useStore((s) => s.hbdPriceUsd);
  const resources = useStore((s) => s.resources);
  const refreshAccountData = useStore((s) => s.refreshAccountData);

  const balances = useMemo(() => {
    if (!activeAccountData || !globalProperties) {
      return {
        hive: 0,
        hbd: 0,
        hp: 0,
        savingsHive: 0,
        savingsHbd: 0,
        vestingShares: 0,
        delegatedVests: 0,
        receivedVests: 0,
        hiveUsd: 0,
        hbdUsd: 0,
        hpUsd: 0,
        totalUsd: 0,
      };
    }

    const hive = parseAmount(activeAccountData.balance as any).amount;
    const hbd = parseAmount(activeAccountData.hbd_balance as any).amount;
    const savingsHive = parseAmount(activeAccountData.savings_balance as any).amount;
    const savingsHbd = parseAmount(activeAccountData.savings_hbd_balance as any).amount;
    const vestingShares = parseAmount(activeAccountData.vesting_shares as any).amount;
    const delegatedVests = parseAmount(activeAccountData.delegated_vesting_shares as any).amount;
    const receivedVests = parseAmount(activeAccountData.received_vesting_shares as any).amount;
    const effectiveVests = vestingShares - delegatedVests + receivedVests;
    const hp = vestsToHP(effectiveVests, globalProperties);

    const hiveUsd = hive * hivePriceUsd;
    const hbdUsd = hbd * hbdPriceUsd;
    const hpUsd = hp * hivePriceUsd;
    const totalUsd = calculateAccountValue(
      activeAccountData,
      globalProperties,
      hivePriceUsd,
      hbdPriceUsd
    );

    return {
      hive,
      hbd,
      hp,
      savingsHive,
      savingsHbd,
      vestingShares,
      delegatedVests,
      receivedVests,
      hiveUsd,
      hbdUsd,
      hpUsd,
      totalUsd,
    };
  }, [activeAccountData, globalProperties, hivePriceUsd, hbdPriceUsd]);

  const rewards = useMemo(() => {
    if (!activeAccountData) {
      return { hive: 0, hbd: 0, hp: 0, hasPending: false };
    }
    return {
      hive: parseAmount(activeAccountData.reward_hive_balance as any || '0 HIVE').amount,
      hbd: parseAmount(activeAccountData.reward_hbd_balance as any || '0 HBD').amount,
      hp: parseAmount(
        activeAccountData.reward_vesting_balance as any || '0.000000 VESTS'
      ).amount,
      hasPending: hasPendingRewards(activeAccountData),
    };
  }, [activeAccountData]);

  return {
    balances,
    rewards,
    resources,
    globalProperties,
    hivePriceUsd,
    hbdPriceUsd,
    formatNumber,
    formatUsd,
    refreshAccountData,
  };
}
