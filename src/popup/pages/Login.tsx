import { useState, useEffect } from 'react';
import { Fingerprint } from 'lucide-react';
import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { useStore } from '@/popup/store';
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  authenticateWithBiometric,
} from '@/core/biometric/webauthn';

export function Login() {
  const unlock = useStore((s) => s.unlock);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [isBioAuth, setIsBioAuth] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  async function checkBiometric() {
    const [available, enrolled] = await Promise.all([
      isBiometricAvailable(),
      isBiometricEnrolled(),
    ]);
    setBiometricReady(available && enrolled);

    // Auto-trigger biometric on load if available
    if (available && enrolled) {
      handleBiometricUnlock();
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsUnlocking(true);

    const success = await unlock(password);
    if (!success) {
      setError('Incorrect password');
      setPassword('');
    }
    setIsUnlocking(false);
  };

  const handleBiometricUnlock = async () => {
    setIsBioAuth(true);
    setError('');

    try {
      const pw = await authenticateWithBiometric();
      if (pw) {
        const success = await unlock(pw);
        if (!success) {
          setError('Biometric succeeded but password is invalid. Please enter manually.');
        }
      } else {
        // User cancelled or it failed silently
        setError('');
      }
    } catch {
      setError('Biometric authentication failed');
    }

    setIsBioAuth(false);
  };

  return (
    <div className="flex flex-col h-full items-center justify-center bg-bg px-8">
      {/* Decorative elements */}
      <div className="absolute top-8 right-8 w-20 h-20 rounded-full bg-coral/5" />
      <div className="absolute bottom-16 left-6 w-12 h-12 rounded-full bg-hive/5" />

      {/* Logo */}
      <div className="relative mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-hero flex items-center justify-center glow-hive">
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
        <div className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-success/25" />
      </div>

      <h1 className="text-2xl font-extrabold text-text-primary mb-1 tracking-tight">
        Welcome Back
      </h1>
      <p className="text-sm text-text-secondary mb-8">
        Unlock your Signet wallet
      </p>

      {/* Biometric unlock button */}
      {biometricReady && (
        <div className="w-full mb-5">
          <button
            onClick={handleBiometricUnlock}
            disabled={isBioAuth}
            className="w-full flex flex-col items-center gap-3 py-5 rounded-2xl bg-surface-elevated border border-border hover:border-hive/30 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <div className={`w-12 h-12 rounded-xl bg-hive/10 flex items-center justify-center ${isBioAuth ? 'animate-pulse-glow' : ''}`}>
              <Fingerprint size={24} className="text-hive" />
            </div>
            <span className="text-sm font-semibold text-text-primary">
              {isBioAuth ? 'Authenticating...' : 'Unlock with Fingerprint'}
            </span>
          </button>

          <div className="relative flex items-center gap-3 py-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-text-tertiary">or enter password</span>
            <div className="flex-1 h-px bg-border" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full space-y-5">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          placeholder="Enter your password"
          error={error}
          autoFocus={!biometricReady}
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={isUnlocking}
          disabled={!password}
        >
          Unlock
        </Button>
      </form>
    </div>
  );
}
