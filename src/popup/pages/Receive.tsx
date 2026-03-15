import { useState, useEffect } from 'react';
import { Copy, Check, QrCode, Link, Smartphone } from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Card } from '@/popup/components/ui/Card';
import { Avatar } from '@/popup/components/ui/Avatar';
import { Input } from '@/popup/components/ui/Input';
import { Button } from '@/popup/components/ui/Button';
import { useStore } from '@/popup/store';
import {
  generateQRDataUrl,
  buildTransferUri,
  buildHivesignerUrl,
  type HiveTransferQR,
} from '@/core/qr';

type QRMode = 'signet' | 'mobile';

export function Receive() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrMode, setQrMode] = useState<QRMode>('mobile');

  // Optional pre-filled amount
  const [requestAmount, setRequestAmount] = useState('');
  const [requestCurrency, setRequestCurrency] = useState<'HIVE' | 'HBD'>('HIVE');

  useEffect(() => {
    regenerateQR();
  }, [activeAccountName, requestAmount, requestCurrency, qrMode]);

  function buildData(): HiveTransferQR {
    const data: HiveTransferQR = { to: activeAccountName || '' };
    if (requestAmount && parseFloat(requestAmount) > 0) {
      data.amount = parseFloat(requestAmount).toFixed(3);
      data.currency = requestCurrency;
    }
    return data;
  }

  async function regenerateQR() {
    if (!activeAccountName) return;
    const data = buildData();
    const uri = qrMode === 'mobile' ? buildHivesignerUrl(data) : buildTransferUri(data);
    const url = await generateQRDataUrl(uri, { width: 240 });
    setQrDataUrl(url);
  }

  function getLink(): string {
    const data = buildData();
    return qrMode === 'mobile' ? buildHivesignerUrl(data) : buildTransferUri(data);
  }

  const handleCopyUsername = async () => {
    if (!activeAccountName) return;
    await navigator.clipboard.writeText(activeAccountName);
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 2000);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(getLink());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <PageContainer title="Receive" showBack>
      <div className="flex flex-col items-center pt-2 space-y-4">
        {/* Avatar & username */}
        {activeAccountName && <Avatar username={activeAccountName} size="lg" />}
        <div className="text-center">
          <h3 className="text-xl font-extrabold text-text-primary">
            @{activeAccountName}
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Share your QR code or payment link
          </p>
        </div>

        {/* QR mode toggle */}
        <div className="w-full flex bg-surface-elevated rounded-2xl p-1">
          <button
            onClick={() => setQrMode('mobile')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              qrMode === 'mobile'
                ? 'bg-hive text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Smartphone size={13} />
            Mobile (Hivesigner)
          </button>
          <button
            onClick={() => setQrMode('signet')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              qrMode === 'signet'
                ? 'bg-hive text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <QrCode size={13} />
            Signet (Desktop)
          </button>
        </div>

        {/* QR Code */}
        <Card variant="elevated" padding="md" className="w-full flex justify-center">
          {qrDataUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={qrDataUrl}
                alt={`QR code for @${activeAccountName}`}
                className="w-48 h-48 rounded-xl"
              />
              <p className="text-[10px] text-text-tertiary text-center max-w-[220px]">
                {qrMode === 'mobile'
                  ? 'Scan with any phone camera — opens Hivesigner to complete the transfer'
                  : 'Paste the link into Signet\'s Send field to auto-fill'}
              </p>
            </div>
          ) : (
            <div className="w-48 h-48 rounded-xl shimmer" />
          )}
        </Card>

        {/* Request specific amount */}
        <Card variant="outline" padding="sm" className="w-full">
          <p className="text-[11px] font-semibold text-text-secondary tracking-widest uppercase mb-2 px-1">
            Request Amount (optional)
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder="0.000"
                step="0.001"
                rightElement={
                  <select
                    value={requestCurrency}
                    onChange={(e) => setRequestCurrency(e.target.value as 'HIVE' | 'HBD')}
                    className="text-[11px] font-bold text-hive cursor-pointer bg-transparent"
                  >
                    <option value="HIVE">HIVE</option>
                    <option value="HBD">HBD</option>
                  </select>
                }
              />
            </div>
          </div>
        </Card>

        {/* Copy buttons */}
        <div className="w-full flex gap-2.5">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={handleCopyUsername}
            icon={copiedUsername ? <Check size={14} /> : <Copy size={14} />}
          >
            {copiedUsername ? 'Copied' : 'Username'}
          </Button>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleCopyLink}
            icon={copiedLink ? <Check size={14} /> : <Link size={14} />}
          >
            {copiedLink ? 'Copied' : qrMode === 'mobile' ? 'Payment Link' : 'Signet Link'}
          </Button>
        </div>

        <p className="text-[10px] text-text-tertiary text-center px-4 leading-relaxed pb-2">
          {qrMode === 'mobile'
            ? 'The mobile link opens Hivesigner in the browser. The recipient signs the transfer there — no extension needed.'
            : 'Paste the Signet link into the Send page recipient field to auto-fill all transfer details.'}
        </p>
      </div>
    </PageContainer>
  );
}
