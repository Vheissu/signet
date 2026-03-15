import { Shield, Zap, Globe } from 'lucide-react';
import { Button } from '@/popup/components/ui/Button';
import { useStore } from '@/popup/store';

export function Welcome() {
  const navigateTo = useStore((s) => s.navigateTo);

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* Logo */}
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-3xl gradient-hero flex items-center justify-center glow-hive animate-pulse-glow">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M20 4L34 12V28L20 36L6 28V12L20 4Z"
                stroke="white"
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d="M20 10L28 15V25L20 30L12 25V15L20 10Z"
                fill="white"
                fillOpacity="0.9"
              />
            </svg>
          </div>
          {/* Decorative circles */}
          <div className="absolute -top-2 -right-3 w-5 h-5 rounded-full bg-coral/30" />
          <div className="absolute -bottom-1 -left-4 w-3 h-3 rounded-full bg-success/30" />
        </div>

        <h1 className="text-3xl font-extrabold text-text-primary mb-2 tracking-tight">
          Signet
        </h1>
        <p className="text-sm text-text-secondary mb-10 leading-relaxed max-w-[260px]">
          The modern, ultra-secure wallet for the Hive blockchain
        </p>

        {/* Feature highlights */}
        <div className="w-full space-y-2.5 mb-8">
          <FeatureRow
            icon={<Shield size={16} />}
            title="Bank-Grade Security"
            description="AES-256-GCM with 600K PBKDF2 rounds"
            accent="bg-hive/12 text-hive"
          />
          <FeatureRow
            icon={<Zap size={16} />}
            title="Lightning Fast"
            description="Built with modern tech for instant response"
            accent="bg-coral/12 text-coral"
          />
          <FeatureRow
            icon={<Globe size={16} />}
            title="Full dApp Support"
            description="Seamless Hive ecosystem integration"
            accent="bg-success/12 text-success"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-8 space-y-3">
        <Button
          fullWidth
          size="lg"
          onClick={() => navigateTo('createPassword')}
        >
          Get Started
        </Button>
        <p className="text-center text-[11px] text-text-tertiary">
          Your keys never leave this device
        </p>
      </div>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3.5 text-left bg-surface/80 rounded-2xl px-4 py-3.5 border border-border">
      <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-text-primary">{title}</p>
        <p className="text-[11px] text-text-tertiary">{description}</p>
      </div>
    </div>
  );
}
