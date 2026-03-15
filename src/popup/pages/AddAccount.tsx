import { useState } from 'react';
import { UserPlus, Key, AlertTriangle, CheckCircle, Upload, ArrowLeft } from 'lucide-react';
import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { Card } from '@/popup/components/ui/Card';
import { Badge } from '@/popup/components/ui/Badge';
import { useStore } from '@/popup/store';
import { getAccount } from '@/core/hive/client';
import { validatePrivateKey, identifyKeyRole } from '@/core/crypto/hive-keys';
import type { StoredAccount, KeyRole } from '@/core/types';

export function AddAccount() {
  const addAccount = useStore((s) => s.addAccount);
  const navigateTo = useStore((s) => s.navigateTo);
  const resetTo = useStore((s) => s.resetTo);
  const addToast = useStore((s) => s.addToast);
  const accounts = useStore((s) => s.accounts);

  const [username, setUsername] = useState('');
  const [keys, setKeys] = useState({ posting: '', active: '', memo: '' });
  const [detectedRoles, setDetectedRoles] = useState<Record<string, KeyRole | null>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'username' | 'keys'>('username');
  const [accountData, setAccountData] = useState<any>(null);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsValidating(true);

    try {
      const cleanUsername = username.replace('@', '').trim().toLowerCase();
      const account = await getAccount(cleanUsername);

      if (!account) {
        setError('Account not found on the Hive blockchain');
        setIsValidating(false);
        return;
      }

      setAccountData(account);
      setUsername(cleanUsername);
      setStep('keys');
    } catch (err: any) {
      setError(err.message || 'Failed to lookup account');
    }

    setIsValidating(false);
  };

  const handleKeyChange = (field: string, value: string) => {
    setKeys((prev) => ({ ...prev, [field]: value }));

    // Auto-detect key role
    if (value && accountData) {
      if (validatePrivateKey(value)) {
        const role = identifyKeyRole(value, accountData);
        setDetectedRoles((prev) => ({ ...prev, [field]: role }));
      } else {
        setDetectedRoles((prev) => ({ ...prev, [field]: null }));
      }
    } else {
      setDetectedRoles((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleAddAccount = async () => {
    setError('');
    setIsValidating(true);

    // Build the account with only valid keys
    const accountKeys: StoredAccount['keys'] = {};
    let hasValidKey = false;

    for (const [field, wif] of Object.entries(keys)) {
      if (wif && validatePrivateKey(wif)) {
        const role = identifyKeyRole(wif, accountData);
        if (role) {
          accountKeys[role] = wif;
          hasValidKey = true;
        }
      }
    }

    if (!hasValidKey) {
      setError('At least one valid private key is required');
      setIsValidating(false);
      return;
    }

    try {
      await addAccount({ username, keys: accountKeys });
      addToast(`@${username} added successfully`, 'success');
      resetTo('dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to add account');
    }

    setIsValidating(false);
  };

  const goBack = useStore((s) => s.goBack);
  const navStack = useStore((s) => s.navStack);
  const canGoBack = navStack.length > 1;

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Top bar with back */}
      {canGoBack && (
        <div className="flex items-center px-4 h-14 border-b border-border flex-shrink-0">
          <button
            onClick={goBack}
            className="p-1.5 -ml-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-base font-bold text-text-primary ml-3">Add Account</h2>
        </div>
      )}

      <div className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-hive/10 flex items-center justify-center text-hive">
            <UserPlus size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              {canGoBack ? '' : 'Add Account'}
            </h2>
            <p className="text-xs text-text-secondary">
              {step === 'username' ? 'Enter your Hive username' : 'Import your private keys'}
            </p>
          </div>
        </div>

        {step === 'username' ? (
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <Input
              label="Hive Username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username (without @)"
              autoFocus
              error={error}
              icon={<span className="text-text-tertiary font-bold text-sm">@</span>}
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isValidating}
              disabled={!username.trim()}
            >
              Continue
            </Button>

            <div className="relative flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-text-tertiary">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="secondary"
              fullWidth
              size="lg"
              onClick={() => navigateTo('importKeys')}
              icon={<Upload size={16} />}
            >
              Import from Password Manager
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Username confirmed */}
            <Card variant="gradient" padding="sm">
              <div className="flex items-center gap-2.5 px-1">
                <CheckCircle size={16} className="text-success" />
                <span className="text-sm font-medium text-text-primary">
                  @{username}
                </span>
                <Badge variant="success">Verified</Badge>
              </div>
            </Card>

            {/* Key inputs */}
            <div className="space-y-3">
              {(['posting', 'active', 'memo'] as const).map((role) => (
                <div key={role}>
                  <Input
                    label={`${role.charAt(0).toUpperCase() + role.slice(1)} Key`}
                    type="password"
                    value={keys[role]}
                    onChange={(e) => handleKeyChange(role, e.target.value)}
                    placeholder={`Enter ${role} private key (optional)`}
                    icon={<Key size={14} />}
                    rightElement={
                      detectedRoles[role] ? (
                        <Badge variant="success">{detectedRoles[role]}</Badge>
                      ) : keys[role] && !validatePrivateKey(keys[role]) ? (
                        <Badge variant="error">Invalid</Badge>
                      ) : null
                    }
                  />
                </div>
              ))}
            </div>

            {/* Warning */}
            <Card variant="outline" padding="sm">
              <div className="flex items-start gap-2.5 px-1">
                <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">
                  Your keys are encrypted locally with AES-256-GCM and never
                  leave your device. At minimum, add your <strong className="text-text-primary">Posting Key</strong> for
                  basic operations.
                </p>
              </div>
            </Card>

            {error && (
              <p className="text-xs text-error text-center">{error}</p>
            )}

            <div className="flex gap-3 pt-2 pb-4">
              <Button variant="secondary" onClick={() => setStep('username')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleAddAccount}
                loading={isValidating}
                disabled={!Object.values(keys).some((k) => k)}
                className="flex-1"
              >
                Add Account
              </Button>
            </div>

            {accounts.length > 0 && (
              <button
                onClick={() => resetTo('dashboard')}
                className="w-full text-center text-xs text-text-tertiary hover:text-text-secondary py-2"
              >
                Skip for now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
