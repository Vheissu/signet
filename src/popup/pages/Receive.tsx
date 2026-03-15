import { useState, useEffect } from 'react';
import { Copy, Check, QrCode } from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Card } from '@/popup/components/ui/Card';
import { Avatar } from '@/popup/components/ui/Avatar';
import { useStore } from '@/popup/store';
import { generateReceiveQR } from '@/core/qr';

export function Receive() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (activeAccountName) {
      generateReceiveQR(activeAccountName, { width: 240 }).then(setQrDataUrl);
    }
  }, [activeAccountName]);

  const handleCopy = async () => {
    if (!activeAccountName) return;
    await navigator.clipboard.writeText(activeAccountName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageContainer title="Receive" showBack>
      <div className="flex flex-col items-center pt-4 space-y-5">
        {/* Avatar */}
        {activeAccountName && (
          <Avatar username={activeAccountName} size="lg" />
        )}

        {/* Username */}
        <div className="text-center">
          <h3 className="text-xl font-extrabold text-text-primary">
            @{activeAccountName}
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Share your username or QR code to receive HIVE or HBD
          </p>
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
              <div className="flex items-center gap-1.5 text-text-tertiary">
                <QrCode size={12} />
                <p className="text-[10px]">
                  Scan to send HIVE to @{activeAccountName}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-48 h-48 rounded-xl shimmer" />
          )}
        </Card>

        {/* Copy card */}
        <Card variant="gradient" padding="md" className="w-full">
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-between gap-3 group"
          >
            <div className="flex-1 text-left">
              <p className="text-[11px] text-text-secondary font-medium uppercase tracking-wider mb-0.5">
                Hive Username
              </p>
              <p className="text-base font-bold text-text-primary">
                @{activeAccountName}
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                copied
                  ? 'bg-success/12 text-success'
                  : 'bg-surface-overlay text-text-secondary group-hover:bg-hive/12 group-hover:text-hive'
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </div>
          </button>
        </Card>

        <p className="text-[11px] text-text-tertiary text-center px-4 leading-relaxed">
          On Hive, transfers go to usernames, not complex addresses.
          Share <strong className="text-text-secondary">@{activeAccountName}</strong> with
          the sender or let them scan the QR code above.
        </p>
      </div>
    </PageContainer>
  );
}
