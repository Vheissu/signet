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
import { ApproveRequest } from '@/popup/pages/ApproveRequest';

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
  approveRequest: ApproveRequest,
};

export function App() {
  const currentPage = useStore((s) => s.currentPage);
  const isLoading = useStore((s) => s.isLoading);
  const loadingMessage = useStore((s) => s.loadingMessage);
  const initialize = useStore((s) => s.initialize);
  const isLocked = useStore((s) => s.isLocked);
  const isInitialized = useStore((s) => s.isInitialized);
  const hasPending = useStore((s) => s.pendingRequests.length > 0);
  const pendingLoaded = useStore((s) => s.pendingRequestsLoaded);
  const isRequestWindow = useStore((s) => s.isRequestWindow);
  const loadPendingRequests = useStore((s) => s.loadPendingRequests);
  const lock = useStore((s) => s.lock);
  const theme = useStore((s) => s.settings.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // The approval window exists only to serve the queue. Once the queue has
  // been read and is empty (every request answered, or the requesting tab
  // went away), close it.
  useEffect(() => {
    if (isRequestWindow && pendingLoaded && !hasPending) {
      window.close();
    }
  }, [isRequestWindow, pendingLoaded, hasPending]);

  useEffect(() => {
    initialize();

    if (typeof chrome === 'undefined' || !chrome?.runtime?.onMessage) return;

    // Keep the popup in sync with the background worker
    const listener = (message: any) => {
      if (message?.type === 'PENDING_REQUESTS_CHANGED') loadPendingRequests();
      if (message?.type === 'LOCKED') lock();
    };
    chrome.runtime.onMessage.addListener(listener);

    // Hold a port open while the popup is visible so auto-lock knows we are active
    let port: chrome.runtime.Port | null = null;
    try {
      port = chrome.runtime.connect({ name: 'popup' });
    } catch {
      // not running as an extension
    }

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      port?.disconnect();
    };
  }, []);

  // Loading screen
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-bg">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl gradient-hero flex items-center justify-center mb-5">
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

  // A dApp is waiting for a decision: show it as soon as the wallet is unlocked
  const PageComponent =
    hasPending && isInitialized && !isLocked ? ApproveRequest : pages[currentPage] || Welcome;

  return (
    <>
      <PageComponent />
      <ToastContainer />
    </>
  );
}
