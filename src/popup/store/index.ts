/**
 * Signet State Management
 *
 * Uses Zustand for lightweight, reactive state management.
 * State is divided into navigation, auth, accounts, and blockchain data.
 */

import { create } from 'zustand';
import type { ExtendedAccount, DynamicGlobalProperties } from '@hiveio/dhive';
import type { Page, NavigationEntry, StoredAccount, Settings, AccountResources } from '@/core/types';
import { DEFAULT_SETTINGS } from '@/core/types';
import { encryptToString, decryptFromString } from '@/core/crypto/encryption';
import { secureStorage } from '@/core/storage/secure-storage';
import { getAccount, getDynamicGlobalProperties, getResourceCredits, getCurrentMedianHistoryPrice } from '@/core/hive/client';
import { calculateVotingPower, calculateRC, parseAmount } from '@/core/hive/operations';

export interface AppState {
  // Navigation
  navStack: NavigationEntry[];
  currentPage: Page;
  pageParams: Record<string, any>;

  // Auth
  isInitialized: boolean;
  isLocked: boolean;
  password: string | null;
  isLoading: boolean;
  loadingMessage: string;

  // Accounts
  accounts: StoredAccount[];
  activeAccountName: string | null;
  activeAccountData: ExtendedAccount | null;
  resources: AccountResources | null;

  // Blockchain
  globalProperties: DynamicGlobalProperties | null;
  hivePriceUsd: number;
  hbdPriceUsd: number;

  // Settings
  settings: Settings;

  // UI
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>;

  // Actions
  initialize: () => Promise<void>;
  navigateTo: (page: Page, params?: Record<string, any>) => void;
  goBack: () => void;
  resetTo: (page: Page, params?: Record<string, any>) => void;
  createWallet: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  addAccount: (account: StoredAccount) => Promise<void>;
  updateAccountKeys: (username: string, newKeys: Partial<StoredAccount['keys']>) => Promise<void>;
  removeAccount: (username: string) => Promise<void>;
  setActiveAccount: (username: string) => Promise<void>;
  refreshAccountData: () => Promise<void>;
  refreshPrices: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  setLoading: (loading: boolean, message?: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  navStack: [{ page: 'welcome' }],
  currentPage: 'welcome',
  pageParams: {},
  isInitialized: false,
  isLocked: true,
  password: null,
  isLoading: true,
  loadingMessage: 'Loading Signet...',
  accounts: [],
  activeAccountName: null,
  activeAccountData: null,
  resources: null,
  globalProperties: null,
  hivePriceUsd: 0,
  hbdPriceUsd: 0,
  settings: DEFAULT_SETTINGS,
  toasts: [],

  // --- Navigation (persisted to session storage so popup reopen restores state) ---

  navigateTo: (page, params = {}) => {
    set((state) => {
      const newStack = [...state.navStack, { page, params }];
      secureStorage.setNavState(newStack);
      return {
        navStack: newStack,
        currentPage: page,
        pageParams: params,
      };
    });
  },

  goBack: () => {
    set((state) => {
      if (state.navStack.length <= 1) return state;
      const newStack = state.navStack.slice(0, -1);
      const current = newStack[newStack.length - 1];
      secureStorage.setNavState(newStack);
      return {
        navStack: newStack,
        currentPage: current.page,
        pageParams: current.params || {},
      };
    });
  },

  resetTo: (page, params = {}) => {
    const newStack = [{ page, params }];
    secureStorage.setNavState(newStack);
    set({
      navStack: newStack,
      currentPage: page,
      pageParams: params,
    });
  },

  // --- Initialization ---

  initialize: async () => {
    try {
      set({ isLoading: true, loadingMessage: 'Loading Signet...' });

      // Load settings
      const settings = await secureStorage.getSettings();

      // Check if wallet is initialized (has accounts)
      const encryptedAccounts = await secureStorage.getEncryptedAccounts();
      const isInitialized = !!encryptedAccounts;

      if (!isInitialized) {
        set({
          isInitialized: false,
          isLocked: true,
          isLoading: false,
          settings,
          currentPage: 'welcome',
          navStack: [{ page: 'welcome' }],
        });
        return;
      }

      // Check if we have a session password (still unlocked)
      const sessionPassword = await secureStorage.getSessionPassword();

      if (!sessionPassword) {
        set({
          isInitialized: true,
          isLocked: true,
          isLoading: false,
          settings,
          currentPage: 'login',
          navStack: [{ page: 'login' }],
        });
        return;
      }

      // Wallet is initialized and unlocked - decrypt and load
      try {
        const accounts: StoredAccount[] = await decryptFromString(
          encryptedAccounts,
          sessionPassword
        );
        const activeAccountName = await secureStorage.getActiveAccountName();
        const activeName = activeAccountName || accounts[0]?.username || null;

        // Restore saved navigation state (so popup reopens where you left off)
        const savedNav = await secureStorage.getNavState();
        let navStack: NavigationEntry[] = [{ page: 'dashboard' }];
        let currentPage: Page = 'dashboard';
        let pageParams: Record<string, any> = {};

        if (savedNav?.navStack?.length) {
          navStack = savedNav.navStack;
          const current = navStack[navStack.length - 1];
          currentPage = current.page;
          pageParams = current.params || {};
        }

        set({
          isInitialized: true,
          isLocked: false,
          password: sessionPassword,
          accounts,
          activeAccountName: activeName,
          settings,
          currentPage,
          navStack,
          pageParams,
          isLoading: false,
        });

        // Load blockchain data in background
        if (activeName) {
          get().refreshAccountData();
          get().refreshPrices();
        }
      } catch {
        // Password in session is invalid (unlikely but possible)
        await secureStorage.setSessionPassword(null);
        set({
          isInitialized: true,
          isLocked: true,
          isLoading: false,
          settings,
          currentPage: 'login',
          navStack: [{ page: 'login' }],
        });
      }
    } catch (err) {
      console.error('[Signet] Initialization error:', err);
      set({
        isLoading: false,
        currentPage: 'welcome',
        navStack: [{ page: 'welcome' }],
      });
    }
  },

  // --- Auth ---

  createWallet: async (password) => {
    set({ isLoading: true, loadingMessage: 'Creating wallet...' });

    // Encrypt an empty accounts array
    const encrypted = await encryptToString([], password);
    await secureStorage.setEncryptedAccounts(encrypted);
    await secureStorage.setSessionPassword(password);

    set({
      isInitialized: true,
      isLocked: false,
      password,
      accounts: [],
      isLoading: false,
      currentPage: 'addAccount',
      navStack: [{ page: 'addAccount' }],
    });
  },

  unlock: async (password) => {
    set({ isLoading: true, loadingMessage: 'Unlocking...' });

    try {
      const encryptedAccounts = await secureStorage.getEncryptedAccounts();
      if (!encryptedAccounts) {
        set({ isLoading: false });
        return false;
      }

      const accounts: StoredAccount[] = await decryptFromString(
        encryptedAccounts,
        password
      );

      await secureStorage.setSessionPassword(password);
      const activeAccountName = await secureStorage.getActiveAccountName();
      const activeName = activeAccountName || accounts[0]?.username || null;

      set({
        isLocked: false,
        password,
        accounts,
        activeAccountName: activeName,
        isLoading: false,
        currentPage: 'dashboard',
        navStack: [{ page: 'dashboard' }],
      });

      // Load blockchain data
      if (activeName) {
        get().refreshAccountData();
        get().refreshPrices();
      }

      return true;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  lock: () => {
    secureStorage.setSessionPassword(null);
    set({
      isLocked: true,
      password: null,
      accounts: [],
      activeAccountData: null,
      resources: null,
      currentPage: 'login',
      navStack: [{ page: 'login' }],
    });
  },

  // --- Account Management ---

  addAccount: async (account) => {
    const { password, accounts } = get();
    if (!password) return;

    // Encrypt each key individually
    const encryptedKeys: StoredAccount['keys'] = {};
    for (const [role, wif] of Object.entries(account.keys)) {
      if (wif) {
        encryptedKeys[role as keyof StoredAccount['keys']] = await encryptToString(
          wif,
          password
        );
      }
    }

    const storedAccount: StoredAccount = {
      username: account.username,
      keys: encryptedKeys,
    };

    const newAccounts = [...accounts.filter((a) => a.username !== account.username), storedAccount];
    const encrypted = await encryptToString(newAccounts, password);
    await secureStorage.setEncryptedAccounts(encrypted);

    const activeAccountName = get().activeAccountName || account.username;
    await secureStorage.setActiveAccountName(activeAccountName);

    set({
      accounts: newAccounts,
      activeAccountName,
    });

    // Load account data
    get().refreshAccountData();
    get().refreshPrices();
  },

  updateAccountKeys: async (username, newKeys) => {
    const { password, accounts } = get();
    if (!password) return;

    const existing = accounts.find((a) => a.username === username);
    if (!existing) return;

    // Merge: keep existing encrypted keys, add/overwrite with new ones
    const mergedKeys = { ...existing.keys };
    for (const [role, wif] of Object.entries(newKeys)) {
      if (wif) {
        mergedKeys[role as keyof StoredAccount['keys']] = await encryptToString(wif, password);
      }
    }

    const updatedAccount: StoredAccount = { username, keys: mergedKeys };
    const newAccounts = accounts.map((a) => (a.username === username ? updatedAccount : a));
    const encrypted = await encryptToString(newAccounts, password);
    await secureStorage.setEncryptedAccounts(encrypted);

    set({ accounts: newAccounts });
  },

  removeAccount: async (username) => {
    const { password, accounts, activeAccountName } = get();
    if (!password) return;

    const newAccounts = accounts.filter((a) => a.username !== username);
    const encrypted = await encryptToString(newAccounts, password);
    await secureStorage.setEncryptedAccounts(encrypted);

    const newActive =
      activeAccountName === username
        ? newAccounts[0]?.username || null
        : activeAccountName;

    if (newActive) {
      await secureStorage.setActiveAccountName(newActive);
    }

    set({
      accounts: newAccounts,
      activeAccountName: newActive,
    });

    if (newAccounts.length === 0) {
      set({
        currentPage: 'addAccount',
        navStack: [{ page: 'addAccount' }],
      });
    } else {
      get().refreshAccountData();
    }
  },

  setActiveAccount: async (username) => {
    await secureStorage.setActiveAccountName(username);
    set({ activeAccountName: username, activeAccountData: null, resources: null });
    get().refreshAccountData();
  },

  // --- Blockchain Data ---

  refreshAccountData: async () => {
    const { activeAccountName } = get();
    if (!activeAccountName) return;

    try {
      const [accountData, globalProps, rcData] = await Promise.all([
        getAccount(activeAccountName),
        getDynamicGlobalProperties(),
        getResourceCredits(activeAccountName),
      ]);

      if (!accountData) return;

      const votingPower = calculateVotingPower(accountData);
      const resourceCredits = rcData ? calculateRC(rcData) : 0;

      set({
        activeAccountData: accountData,
        globalProperties: globalProps,
        resources: {
          votingPower,
          votingMana: votingPower * 100,
          votingManaMax: 10000,
          resourceCredits,
          rcMana: resourceCredits * 100,
          rcManaMax: 10000,
        },
      });
    } catch (err) {
      console.error('[Signet] Failed to refresh account data:', err);
    }
  },

  refreshPrices: async () => {
    try {
      // Fetch HIVE price from CoinGecko
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar&vs_currencies=usd'
      );
      const data = await response.json();

      set({
        hivePriceUsd: data.hive?.usd || 0,
        hbdPriceUsd: data.hive_dollar?.usd || 1,
      });
    } catch {
      // Try using the internal median price as fallback
      try {
        const price = await getCurrentMedianHistoryPrice();
        const base = parseAmount(price.base as any).amount;
        const quote = parseAmount(price.quote as any).amount;
        set({
          hivePriceUsd: base / quote,
          hbdPriceUsd: 1,
        });
      } catch {
        // Leave prices as-is
      }
    }
  },

  // --- Settings ---

  updateSettings: async (partial) => {
    const { settings } = get();
    const newSettings = { ...settings, ...partial };
    await secureStorage.setSettings(newSettings);
    set({ settings: newSettings });
  },

  // --- UI ---

  addToast: (message, type) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    // Auto-remove after 4 seconds
    setTimeout(() => get().removeToast(id), 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  setLoading: (loading, message) => {
    set({
      isLoading: loading,
      loadingMessage: message || 'Loading...',
    });
  },
}));
