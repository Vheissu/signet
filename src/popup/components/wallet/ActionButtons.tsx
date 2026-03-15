import { ArrowUpRight, ArrowDownLeft, Zap, Repeat, PiggyBank, Users } from 'lucide-react';
import { useStore } from '@/popup/store';
import type { Page } from '@/core/types';

interface ActionItem {
  icon: typeof ArrowUpRight;
  label: string;
  page: Page;
  color: string;
  bg: string;
}

const actions: ActionItem[] = [
  {
    icon: ArrowUpRight,
    label: 'Send',
    page: 'send',
    color: 'text-hive',
    bg: 'bg-hive/12',
  },
  {
    icon: ArrowDownLeft,
    label: 'Receive',
    page: 'receive',
    color: 'text-success',
    bg: 'bg-success/12',
  },
  {
    icon: Zap,
    label: 'Stake',
    page: 'staking',
    color: 'text-coral',
    bg: 'bg-coral/12',
  },
  {
    icon: PiggyBank,
    label: 'Savings',
    page: 'savings',
    color: 'text-info',
    bg: 'bg-info/12',
  },
  {
    icon: Users,
    label: 'Delegate',
    page: 'delegation',
    color: 'text-warning',
    bg: 'bg-warning/12',
  },
  {
    icon: Repeat,
    label: 'Swap',
    page: 'swap',
    color: 'text-coral-light',
    bg: 'bg-coral-light/12',
  },
];

export function ActionButtons() {
  const navigateTo = useStore((s) => s.navigateTo);

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {actions.map(({ icon: Icon, label, page, color, bg }) => (
        <button
          key={label}
          onClick={() => navigateTo(page)}
          className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl ${bg} border border-border/50 transition-all duration-200 hover:border-border active:scale-95`}
        >
          <div className={color}>
            <Icon size={20} strokeWidth={1.8} />
          </div>
          <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
        </button>
      ))}
    </div>
  );
}
