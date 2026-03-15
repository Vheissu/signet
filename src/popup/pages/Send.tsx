import { useState, useRef } from 'react';
import { ArrowUpRight, AlertTriangle, ScanLine } from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Input } from '@/popup/components/ui/Input';
import { Button } from '@/popup/components/ui/Button';
import { Card } from '@/popup/components/ui/Card';
import { useStore } from '@/popup/store';
import { useHive } from '@/popup/hooks/useHive';
import { useAccounts } from '@/popup/hooks/useAccounts';
import { broadcastTransfer } from '@/core/hive/client';
import { getAccount } from '@/core/hive/client';
import { scanQRFromImage, parseTransferUri } from '@/core/qr';

export function Send() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const addToast = useStore((s) => s.addToast);
  const goBack = useStore((s) => s.goBack);
  const { balances, formatNumber } = useHive();
  const { getDecryptedKey } = useAccounts();
  const pageParams = useStore((s) => s.pageParams);

  const [recipient, setRecipient] = useState(pageParams.to || '');
  const [amount, setAmount] = useState(pageParams.amount || '');
  const [currency, setCurrency] = useState<'HIVE' | 'HBD'>(pageParams.currency || 'HIVE');
  const [memo, setMemo] = useState(pageParams.memo || '');
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const qrFileRef = useRef<HTMLInputElement>(null);

  const maxAmount = currency === 'HIVE' ? balances.hive : balances.hbd;

  const handleScanQR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await scanQRFromImage(file);
    if (data) {
      const parsed = parseTransferUri(data);
      if (parsed) {
        setRecipient(parsed.to);
        if (parsed.amount) setAmount(parsed.amount);
        if (parsed.currency) setCurrency(parsed.currency as 'HIVE' | 'HBD');
        if (parsed.memo) setMemo(parsed.memo);
      } else {
        // Might be a plain username
        setRecipient(data.replace('@', '').trim());
      }
    }
    if (qrFileRef.current) qrFileRef.current.value = '';
  };

  const validateRecipient = async () => {
    if (!recipient) return;
    const clean = recipient.replace('@', '').trim().toLowerCase();
    const account = await getAccount(clean);
    if (!account) {
      setRecipientError('Account not found');
    } else {
      setRecipientError('');
    }
  };

  const handleSend = async () => {
    if (!activeAccountName) return;
    setIsSending(true);

    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Active key required for transfers', 'error');
        setIsSending(false);
        return;
      }

      const clean = recipient.replace('@', '').trim().toLowerCase();
      const amountStr = `${parseFloat(amount).toFixed(3)} ${currency}`;

      await broadcastTransfer(activeAccountName, clean, amountStr, memo, activeKey);

      addToast(`Sent ${amountStr} to @${clean}`, 'success');
      goBack();
    } catch (err: any) {
      addToast(err.message || 'Transfer failed', 'error');
      setShowConfirm(false);
    }

    setIsSending(false);
  };

  return (
    <PageContainer title="Send" showBack>
      <div className="space-y-5">
        {/* Hidden file input for QR scan */}
        <input
          ref={qrFileRef}
          type="file"
          accept="image/*"
          onChange={handleScanQR}
          className="hidden"
        />

        {/* Recipient */}
        <Input
          label="Recipient"
          value={recipient}
          onChange={(e) => {
            const val = e.target.value;
            // Detect pasted hive:// URIs and auto-fill all fields
            if (val.startsWith('hive://')) {
              const parsed = parseTransferUri(val);
              if (parsed) {
                setRecipient(parsed.to);
                if (parsed.amount) setAmount(parsed.amount);
                if (parsed.currency) setCurrency(parsed.currency as 'HIVE' | 'HBD');
                if (parsed.memo) setMemo(parsed.memo);
                setRecipientError('');
                return;
              }
            }
            setRecipient(val);
            setRecipientError('');
          }}
          onBlur={validateRecipient}
          placeholder="Username or hive:// link"
          error={recipientError}
          icon={<span className="text-text-tertiary font-bold text-sm">@</span>}
          rightElement={
            <button
              type="button"
              onClick={() => qrFileRef.current?.click()}
              className="p-1 rounded-lg text-text-tertiary hover:text-hive hover:bg-hive/10 transition-colors"
              title="Scan QR code image"
            >
              <ScanLine size={16} />
            </button>
          }
        />

        {/* Amount */}
        <div>
          <Input
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.000"
            step="0.001"
            min="0.001"
            rightElement={
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'HIVE' | 'HBD')}
                className="text-xs font-bold text-hive cursor-pointer bg-transparent"
              >
                <option value="HIVE">HIVE</option>
                <option value="HBD">HBD</option>
              </select>
            }
          />
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-[11px] text-text-tertiary">
              Available: {formatNumber(maxAmount, 3)} {currency}
            </span>
            <button
              onClick={() => setAmount(maxAmount.toFixed(3))}
              className="text-[11px] font-bold text-hive hover:text-hive-light transition-colors"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Memo */}
        <Input
          label="Memo (Optional)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Add a memo"
          hint={memo.startsWith('#') ? 'This memo will be encrypted' : undefined}
        />

        {/* Confirm section */}
        {!showConfirm ? (
          <div className="pt-2">
            <Button
              fullWidth
              size="lg"
              onClick={() => setShowConfirm(true)}
              disabled={!recipient || !amount || parseFloat(amount) <= 0 || !!recipientError}
              icon={<ArrowUpRight size={16} />}
            >
              Review Transfer
            </Button>
          </div>
        ) : (
          <Card variant="gradient" padding="lg">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-text-primary">
                Confirm Transfer
              </h3>

              <div className="space-y-3 bg-surface rounded-xl p-3.5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">To</span>
                  <span className="text-text-primary font-semibold">
                    @{recipient.replace('@', '')}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Amount</span>
                  <span className="text-text-primary font-bold">
                    {parseFloat(amount).toFixed(3)} {currency}
                  </span>
                </div>
                {memo && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Memo</span>
                      <span className="text-text-primary font-medium truncate max-w-[180px]">
                        {memo}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-start gap-2.5 bg-warning/5 rounded-xl px-3.5 py-3 border border-warning/10">
                <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  This action is irreversible. Double-check the recipient and amount.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="lg"
                  onClick={handleSend}
                  loading={isSending}
                  className="flex-1"
                >
                  Confirm Send
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
