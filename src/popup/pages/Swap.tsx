import { useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import { Header } from '@/popup/components/layout/Header';
import { BottomNav } from '@/popup/components/layout/BottomNav';
import { Input } from '@/popup/components/ui/Input';
import { Button } from '@/popup/components/ui/Button';
import { Card } from '@/popup/components/ui/Card';
import { useStore } from '@/popup/store';
import { useHive } from '@/popup/hooks/useHive';
import { useAccounts } from '@/popup/hooks/useAccounts';
import { broadcastConvert, broadcastCollateralizedConvert } from '@/core/hive/client';

type ConversionType = 'hiveToHbd' | 'hbdToHive';

export function Swap() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const addToast = useStore((s) => s.addToast);
  const { balances, formatNumber, hivePriceUsd, refreshAccountData } = useHive();
  const { getDecryptedKey } = useAccounts();

  const [convType, setConvType] = useState<ConversionType>('hiveToHbd');
  const [amount, setAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);

  const fromCurrency = convType === 'hiveToHbd' ? 'HIVE' : 'HBD';
  const toCurrency = convType === 'hiveToHbd' ? 'HBD' : 'HIVE';
  const maxAmount = convType === 'hiveToHbd' ? balances.hive : balances.hbd;

  const toggleDirection = () => {
    setConvType(convType === 'hiveToHbd' ? 'hbdToHive' : 'hiveToHbd');
    setAmount('');
  };

  const handleSwap = async () => {
    if (!activeAccountName) return;
    setIsSwapping(true);

    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Active key required', 'error');
        setIsSwapping(false);
        return;
      }

      const amountStr = `${parseFloat(amount).toFixed(3)} ${fromCurrency}`;

      if (convType === 'hbdToHive') {
        await broadcastConvert(activeAccountName, amountStr, activeKey);
      } else {
        await broadcastCollateralizedConvert(activeAccountName, amountStr, activeKey);
      }

      addToast(`Conversion initiated: ${amountStr}`, 'success');
      await refreshAccountData();
      setAmount('');
    } catch (err: any) {
      addToast(err.message || 'Conversion failed', 'error');
    }

    setIsSwapping(false);
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-text-secondary tracking-wider uppercase">
            Convert
          </h3>

          {/* From */}
          <Card variant="elevated" padding="md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-secondary">From</span>
              <span className="text-[11px] text-text-tertiary">
                Balance: {formatNumber(maxAmount, 3)} {fromCurrency}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                fromCurrency === 'HIVE' ? 'bg-hive' : 'bg-success'
              }`}>
                {fromCurrency === 'HIVE' ? 'H' : '$'}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.000"
                className="flex-1 bg-transparent text-xl font-bold text-text-primary outline-none placeholder:text-text-tertiary"
              />
              <button
                onClick={() => setAmount(maxAmount.toFixed(3))}
                className="text-xs font-semibold text-hive"
              >
                MAX
              </button>
            </div>
          </Card>

          {/* Swap button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={toggleDirection}
              className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-secondary hover:text-hive hover:border-hive/30 transition-colors active:scale-95"
            >
              <ArrowDownUp size={16} />
            </button>
          </div>

          {/* To */}
          <Card variant="elevated" padding="md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-secondary">To</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                toCurrency === 'HIVE' ? 'bg-hive' : 'bg-success'
              }`}>
                {toCurrency === 'HIVE' ? 'H' : '$'}
              </div>
              <span className="text-xl font-bold text-text-tertiary">
                {amount ? `~${parseFloat(amount).toFixed(3)}` : '0.000'}
              </span>
              <span className="text-sm font-medium text-text-secondary ml-auto">
                {toCurrency}
              </span>
            </div>
          </Card>

          {/* Info */}
          <Card variant="outline" padding="sm">
            <p className="text-xs text-text-secondary leading-relaxed">
              {convType === 'hbdToHive' ? (
                <>
                  HBD to HIVE conversion takes <strong className="text-text-primary">3.5 days</strong>.
                  You'll receive HIVE based on the median price at conversion time.
                </>
              ) : (
                <>
                  HIVE to HBD uses collateralized conversion (<strong className="text-text-primary">3.5 days</strong>).
                  HIVE is used as collateral and you receive HBD.
                </>
              )}
            </p>
          </Card>

          <Button
            fullWidth
            size="lg"
            onClick={handleSwap}
            loading={isSwapping}
            disabled={!amount || parseFloat(amount) <= 0}
            icon={<ArrowDownUp size={16} />}
          >
            Convert {fromCurrency} to {toCurrency}
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
