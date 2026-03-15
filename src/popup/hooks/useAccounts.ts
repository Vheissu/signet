import { useStore } from '@/popup/store';
import { decryptFromString } from '@/core/crypto/encryption';

export function useAccounts() {
  const accounts = useStore((s) => s.accounts);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const activeAccountData = useStore((s) => s.activeAccountData);
  const password = useStore((s) => s.password);
  const addAccount = useStore((s) => s.addAccount);
  const removeAccount = useStore((s) => s.removeAccount);
  const setActiveAccount = useStore((s) => s.setActiveAccount);

  /**
   * Get a decrypted key for the active account.
   */
  async function getDecryptedKey(
    role: 'posting' | 'active' | 'memo' | 'owner'
  ): Promise<string | null> {
    if (!password || !activeAccountName) return null;

    const account = accounts.find((a) => a.username === activeAccountName);
    if (!account?.keys[role]) return null;

    try {
      return await decryptFromString(account.keys[role]!, password);
    } catch {
      return null;
    }
  }

  /**
   * Check if the active account has a specific key role.
   */
  function hasKey(role: 'posting' | 'active' | 'memo' | 'owner'): boolean {
    const account = accounts.find((a) => a.username === activeAccountName);
    return !!account?.keys[role];
  }

  return {
    accounts,
    activeAccountName,
    activeAccountData,
    addAccount,
    removeAccount,
    setActiveAccount,
    getDecryptedKey,
    hasKey,
  };
}
