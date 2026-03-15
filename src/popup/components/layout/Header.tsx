import { ChevronDown, Settings, Lock, RefreshCw } from 'lucide-react';
import { Avatar } from '@/popup/components/ui/Avatar';
import { NotificationBell } from '@/popup/components/wallet/NotificationCenter';
import { useStore } from '@/popup/store';
import { useState } from 'react';

export function Header() {
  const accounts = useStore((s) => s.accounts);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const setActiveAccount = useStore((s) => s.setActiveAccount);
  const navigateTo = useStore((s) => s.navigateTo);
  const lock = useStore((s) => s.lock);
  const refreshAccountData = useStore((s) => s.refreshAccountData);
  const refreshPrices = useStore((s) => s.refreshPrices);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshAccountData(), refreshPrices()]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <header className="relative flex items-center justify-between px-4 h-14 border-b border-border bg-surface/80 backdrop-blur-md z-20 flex-shrink-0">
      {/* Account selector */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2.5 hover:bg-surface-elevated rounded-xl px-2.5 py-2 -ml-2.5 transition-colors"
      >
        {activeAccountName && <Avatar username={activeAccountName} size="sm" />}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-text-primary">
            @{activeAccountName || 'Select'}
          </span>
          <ChevronDown size={12} className="text-text-tertiary" />
        </div>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleRefresh}
          className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-elevated transition-colors"
        >
          <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
        <NotificationBell />
        <button
          onClick={() => navigateTo('settings')}
          className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-elevated transition-colors"
        >
          <Settings size={15} />
        </button>
        <button
          onClick={lock}
          className="p-2 rounded-lg text-text-tertiary hover:text-error hover:bg-error/10 transition-colors"
          title="Lock wallet"
        >
          <Lock size={15} />
        </button>
      </div>

      {/* Account dropdown */}
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute top-full left-4 mt-1.5 w-56 bg-surface-elevated border border-border rounded-xl shadow-xl z-40 overflow-hidden animate-fade-in">
            {accounts.map((account) => (
              <button
                key={account.username}
                onClick={() => {
                  setActiveAccount(account.username);
                  setShowDropdown(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-overlay transition-colors ${
                  account.username === activeAccountName
                    ? 'bg-hive/5 border-l-2 border-l-hive'
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                <Avatar username={account.username} size="sm" />
                <span className="text-sm font-medium text-text-primary">
                  @{account.username}
                </span>
              </button>
            ))}
            <div className="border-t border-border">
              <button
                onClick={() => {
                  navigateTo('addAccount');
                  setShowDropdown(false);
                }}
                className="w-full px-4 py-3 text-sm text-hive font-semibold hover:bg-surface-overlay transition-colors text-left"
              >
                + Add Account
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
