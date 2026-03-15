import { useEffect } from 'react';
import { useStore } from '@/popup/store';
import { ToastContainer } from '@/popup/components/ui/Toast';
import { Spinner } from '@/popup/components/ui/Spinner';

// Pages
import { Welcome } from '@/popup/pages/Welcome';
import { CreatePassword } from '@/popup/pages/CreatePassword';
import { AddAccount } from '@/popup/pages/AddAccount';
import { Login } from '@/popup/pages/Login';
import { Dashboard } from '@/popup/pages/Dashboard';
import { Send } from '@/popup/pages/Send';
import { Receive } from '@/popup/pages/Receive';
import { Staking } from '@/popup/pages/Staking';
import { Governance } from '@/popup/pages/Governance';
import { History } from '@/popup/pages/History';
import { Settings } from '@/popup/pages/Settings';
import { Swap } from '@/popup/pages/Swap';
import { Savings } from '@/popup/pages/Savings';
import { Delegation } from '@/popup/pages/Delegation';
import { ImportKeys } from '@/popup/pages/ImportKeys';
import { EditAccount } from '@/popup/pages/EditAccount';
import { Tokens } from '@/popup/pages/Tokens';
import { TokenDetail } from '@/popup/pages/TokenDetail';
import { Contacts } from '@/popup/pages/Contacts';

import type { Page } from '@/core/types';

const pages: Record<Page, React.ComponentType> = {
  welcome: Welcome,
  createPassword: CreatePassword,
  addAccount: AddAccount,
  login: Login,
  dashboard: Dashboard,
  send: Send,
  receive: Receive,
  staking: Staking,
  governance: Governance,
  history: History,
  settings: Settings,
  swap: Swap,
  savings: Savings,
  delegation: Delegation,
  tokens: Tokens,
  accountManager: Settings,
  tokenDetail: TokenDetail,
  importKeys: ImportKeys,
  editAccount: EditAccount,
  contacts: Contacts,
};

export function App() {
  const currentPage = useStore((s) => s.currentPage);
  const isLoading = useStore((s) => s.isLoading);
  const loadingMessage = useStore((s) => s.loadingMessage);
  const initialize = useStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, []);

  // Loading screen
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gradient-subtle">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl gradient-hero flex items-center justify-center mb-5 animate-pulse-glow">
          <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
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
        <Spinner className="mb-3 text-hive" />
        <p className="text-sm text-text-secondary animate-pulse">
          {loadingMessage}
        </p>
      </div>
    );
  }

  const PageComponent = pages[currentPage] || Welcome;

  return (
    <>
      <PageComponent />
      <ToastContainer />
    </>
  );
}
