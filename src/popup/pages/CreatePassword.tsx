import { useState, useMemo } from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { useStore } from '@/popup/store';

export function CreatePassword() {
  const createWallet = useStore((s) => s.createWallet);
  const goBack = useStore((s) => s.goBack);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
      { label: 'Very Weak', color: 'bg-error' },
      { label: 'Weak', color: 'bg-error' },
      { label: 'Fair', color: 'bg-warning' },
      { label: 'Good', color: 'bg-warning' },
      { label: 'Strong', color: 'bg-success' },
      { label: 'Very Strong', color: 'bg-success' },
    ];

    return { score, ...levels[score] };
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setIsCreating(true);
    try {
      await createWallet(password);
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Top bar with back */}
      <div className="flex items-center px-4 h-14 border-b border-border flex-shrink-0">
        <button
          onClick={goBack}
          className="p-1.5 -ml-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-base font-bold text-text-primary ml-3">Create Password</h2>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-hive/10 flex items-center justify-center text-hive">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-text-secondary">
              This encrypts your keys locally
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a strong password"
            autoFocus
          />

          {/* Strength meter */}
          {password && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i < strength.score ? strength.color : 'bg-surface-overlay'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-text-tertiary">{strength.label}</p>
            </div>
          )}

          <Input
            label="Confirm Password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            error={error}
          />

          <div className="bg-surface-elevated/50 rounded-xl p-3.5 border border-border/50">
            <p className="text-xs text-text-secondary leading-relaxed">
              <span className="text-warning font-semibold">Important:</span> This password encrypts
              your private keys using AES-256 with 600,000 rounds of key
              derivation. There is no way to recover it if forgotten.
            </p>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isCreating}
              disabled={!password || !confirm}
            >
              Create Wallet
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
