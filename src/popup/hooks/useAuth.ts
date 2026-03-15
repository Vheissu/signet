import { useStore } from '@/popup/store';

export function useAuth() {
  const isInitialized = useStore((s) => s.isInitialized);
  const isLocked = useStore((s) => s.isLocked);
  const isLoading = useStore((s) => s.isLoading);
  const createWallet = useStore((s) => s.createWallet);
  const unlock = useStore((s) => s.unlock);
  const lock = useStore((s) => s.lock);

  return {
    isInitialized,
    isLocked,
    isLoading,
    createWallet,
    unlock,
    lock,
  };
}
