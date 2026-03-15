import { LayoutDashboard, Clock, Vote, Coins } from 'lucide-react';
import { useStore } from '@/popup/store';
import type { Page } from '@/core/types';

interface NavItem {
  page: Page;
  icon: typeof LayoutDashboard;
  label: string;
}

const navItems: NavItem[] = [
  { page: 'dashboard', icon: LayoutDashboard, label: 'Wallet' },
  { page: 'tokens', icon: Coins, label: 'Tokens' },
  { page: 'history', icon: Clock, label: 'History' },
  { page: 'governance', icon: Vote, label: 'Govern' },
];

export function BottomNav() {
  const currentPage = useStore((s) => s.currentPage);
  const resetTo = useStore((s) => s.resetTo);

  return (
    <nav className="flex items-stretch h-14 border-t border-border bg-surface/80 backdrop-blur-md flex-shrink-0">
      {navItems.map(({ page, icon: Icon, label }) => {
        const isActive = currentPage === page;
        return (
          <button
            key={page}
            onClick={() => resetTo(page)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative ${
              isActive
                ? 'text-hive'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-hive rounded-full" />
            )}
            <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
            <span className={`text-[10px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
