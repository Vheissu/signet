/**
 * Secure storage wrapper for Chrome extension storage APIs.
 *
 * - chrome.storage.local: Persistent encrypted data (accounts, settings)
 * - chrome.storage.session: Ephemeral session data (password, cleared on browser close)
 */

import type { Settings } from '@/core/types';
import { DEFAULT_SETTINGS } from '@/core/types';

// Check if we're in a Chrome extension context
function isChromeExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage;
}

// Fallback in-memory storage for development
const memoryStore: Record<string, any> = {};

export const secureStorage = {
  // --- Encrypted Accounts ---

  async getEncryptedAccounts(): Promise<string | null> {
    if (!isChromeExtension()) return memoryStore.encryptedAccounts || null;
    const result = await chrome.storage.local.get('encryptedAccounts');
    return result.encryptedAccounts ?? null;
  },

  async setEncryptedAccounts(data: string): Promise<void> {
    if (!isChromeExtension()) {
      memoryStore.encryptedAccounts = data;
      return;
    }
    await chrome.storage.local.set({ encryptedAccounts: data });
  },

  async clearEncryptedAccounts(): Promise<void> {
    if (!isChromeExtension()) {
      delete memoryStore.encryptedAccounts;
      return;
    }
    await chrome.storage.local.remove('encryptedAccounts');
  },

  // --- Settings ---

  async getSettings(): Promise<Settings> {
    if (!isChromeExtension()) return memoryStore.settings || DEFAULT_SETTINGS;
    const result = await chrome.storage.local.get('settings');
    return { ...DEFAULT_SETTINGS, ...result.settings };
  },

  async setSettings(settings: Settings): Promise<void> {
    if (!isChromeExtension()) {
      memoryStore.settings = settings;
      return;
    }
    await chrome.storage.local.set({ settings });
  },

  // --- Session Password (ephemeral) ---

  async getSessionPassword(): Promise<string | null> {
    if (!isChromeExtension()) return memoryStore.sessionPassword || null;
    try {
      const result = await chrome.storage.session.get('password');
      return result.password ?? null;
    } catch {
      // session storage might not be available in all contexts
      return memoryStore.sessionPassword || null;
    }
  },

  async setSessionPassword(password: string | null): Promise<void> {
    if (!isChromeExtension()) {
      memoryStore.sessionPassword = password;
      return;
    }
    try {
      if (password) {
        await chrome.storage.session.set({ password });
      } else {
        await chrome.storage.session.remove('password');
      }
    } catch {
      memoryStore.sessionPassword = password;
    }
  },

  // --- Active Account ---

  async getActiveAccountName(): Promise<string | null> {
    if (!isChromeExtension()) return memoryStore.activeAccount || null;
    const result = await chrome.storage.local.get('activeAccount');
    return result.activeAccount ?? null;
  },

  async setActiveAccountName(username: string): Promise<void> {
    if (!isChromeExtension()) {
      memoryStore.activeAccount = username;
      return;
    }
    await chrome.storage.local.set({ activeAccount: username });
  },

  // --- Password Hash (for quick verification) ---

  async getPasswordCheck(): Promise<string | null> {
    if (!isChromeExtension()) return memoryStore.passwordCheck || null;
    const result = await chrome.storage.local.get('passwordCheck');
    return result.passwordCheck ?? null;
  },

  async setPasswordCheck(check: string): Promise<void> {
    if (!isChromeExtension()) {
      memoryStore.passwordCheck = check;
      return;
    }
    await chrome.storage.local.set({ passwordCheck: check });
  },

  // --- Navigation State (persists across popup close/reopen) ---

  async getNavState(): Promise<{ navStack: any[]; formDrafts: Record<string, any> } | null> {
    if (!isChromeExtension()) return memoryStore.navState || null;
    try {
      const result = await chrome.storage.session.get('navState');
      return result.navState ?? null;
    } catch {
      return null;
    }
  },

  async setNavState(navStack: any[], formDrafts?: Record<string, any>): Promise<void> {
    const value = { navStack, formDrafts: formDrafts || {} };
    if (!isChromeExtension()) {
      memoryStore.navState = value;
      return;
    }
    try {
      await chrome.storage.session.set({ navState: value });
    } catch {
      memoryStore.navState = value;
    }
  },

  async clearNavState(): Promise<void> {
    if (!isChromeExtension()) {
      delete memoryStore.navState;
      return;
    }
    try {
      await chrome.storage.session.remove('navState');
    } catch {
      // ignore
    }
  },

  // --- Form Drafts (survives popup close for in-progress forms) ---

  async getFormDraft(page: string): Promise<Record<string, any> | null> {
    if (!isChromeExtension()) return memoryStore[`draft_${page}`] || null;
    try {
      const result = await chrome.storage.session.get(`draft_${page}`);
      return result[`draft_${page}`] ?? null;
    } catch {
      return null;
    }
  },

  async setFormDraft(page: string, data: Record<string, any>): Promise<void> {
    if (!isChromeExtension()) {
      memoryStore[`draft_${page}`] = data;
      return;
    }
    try {
      await chrome.storage.session.set({ [`draft_${page}`]: data });
    } catch {
      memoryStore[`draft_${page}`] = data;
    }
  },

  async clearFormDraft(page: string): Promise<void> {
    if (!isChromeExtension()) {
      delete memoryStore[`draft_${page}`];
      return;
    }
    try {
      await chrome.storage.session.remove(`draft_${page}`);
    } catch {
      // ignore
    }
  },

  // --- Full Clear ---

  async clearAll(): Promise<void> {
    if (!isChromeExtension()) {
      Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
      return;
    }
    await chrome.storage.local.clear();
    try {
      await chrome.storage.session.clear();
    } catch {
      // ignore
    }
  },
};
