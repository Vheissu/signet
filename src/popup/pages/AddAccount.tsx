import { useState } from 'react';
import { UserPlus, Key, AlertTriangle, CheckCircle, Upload, ArrowLeft, Plus, X } from 'lucide-react';
import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { Card } from '@/popup/components/ui/Card';
import { Badge } from '@/popup/components/ui/Badge';
import { useStore } from '@/popup/store';
import { getAccount } from '@/core/hive/client';
import { validatePrivateKey, identifyKeyRole, deriveKeysFromPassword } from '@/core/crypto/hive-keys';
import type { StoredAccount, KeyRole } from '@/core/types';

type Detection =
  | { kind: 'empty' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'key'; role: KeyRole; keys: Partial<Record<KeyRole, string>> }
  | { kind: 'master'; roles: KeyRole[]; keys: Partial<Record<KeyRole, string>> };

export function AddAccount() {
  const addAccount = useStore((s) => s.addAccount);
  const navigateTo = useStore((s) => s.navigateTo);
  const resetTo = useStore((s) => s.resetTo);
  const addToast = useStore((s) => s.addToast);
  const accounts = useStore((s) => s.accounts);

  const [username, setUsername] = useState('');
  // Keys collected so far, by role. Owner is only stored when pasted directly.
  const [collected, setCollected] = useState<Partial<Record<KeyRole, string>>>({});
  const [secret, setSecret] = useState('');
  const [detection, setDetection] = useState<Detection>({ kind: 'empty' });
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

  /**
   * Work out what was pasted: a private key for one role, the master
   * password (derives posting/active/memo), or nothing usable.
   */
  const detect = (value: string): Detection => {
    const trimmed = value.trim();
    if (!trimmed || !accountData) return { kind: 'empty' };

    if (validatePrivateKey(trimmed)) {
      const role = identifyKeyRole(trimmed, accountData);
      if (!role) return { kind: 'invalid', reason: `This key does not belong to @${username}` };
      return { kind: 'key', role, keys: { [role]: trimmed } };
    }

    const derived = deriveKeysFromPassword(username, trimmed);
    const keys: Partial<Record<KeyRole, string>> = {};
    for (const kp of derived) {
      if (kp.role === 'owner') continue; // keep the owner key off this device
      if (identifyKeyRole(kp.private, accountData) === kp.role) keys[kp.role] = kp.private;
    }
    const roles = Object.keys(keys) as KeyRole[];
    if (roles.length === 0) {
      return { kind: 'invalid', reason: `Not a private key or master password for @${username}` };
    }
    return { kind: 'master', roles, keys };
  };

  const handleSecretChange = (value: string) => {
    setSecret(value);
    setError('');
    setDetection(detect(value));
  };

  const commitDetected = () => {
    if (detection.kind !== 'key' && detection.kind !== 'master') return;
    setCollected((prev) => ({ ...prev, ...detection.keys }));
    setSecret('');
    setDetection({ kind: 'empty' });
  };

  const removeCollected = (role: KeyRole) => {
    setCollected((prev) => {
      const next = { ...prev };
      delete next[role];
      return next;
    });
  };

  const handleAddAccount = async () => {
    setError('');
    setIsValidating(true);

    // Include whatever is still sitting in the field if it is valid
    const pending = detection.kind === 'key' || detection.kind === 'master' ? detection.keys : {};
    const accountKeys: StoredAccount['keys'] = { ...collected, ...pending };

    if (Object.keys(accountKeys).length === 0) {
      setError('Paste at least one private key or your master password');
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

            {/* Keys already collected */}
            {Object.keys(collected).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(collected) as KeyRole[]).map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-success/10 border border-success/20 text-xs font-semibold text-success"
                  >
                    <CheckCircle size={11} />
                    {role} key
                    <button
                      type="button"
                      onClick={() => removeCollected(role)}
                      className="p-0.5 rounded hover:bg-success/20"
                      title="Remove"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* One field takes either a key or the master password */}
            <Input
              label={Object.keys(collected).length > 0 ? 'Add another key' : 'Private key or master password'}
              type="password"
              value={secret}
              onChange={(e) => handleSecretChange(e.target.value)}
              placeholder="Paste a private key or your master password"
              icon={<Key size={14} />}
              autoFocus
              error={detection.kind === 'invalid' ? detection.reason : undefined}
              hint={
                detection.kind === 'master'
                  ? `Master password recognised. Unlocks your ${detection.roles.join(', ')} keys.`
                  : detection.kind === 'key'
                    ? `${detection.role.charAt(0).toUpperCase() + detection.role.slice(1)} key recognised.`
                    : 'Your master password derives the posting, active and memo keys. The owner key is never stored unless you paste it directly.'
              }
              rightElement={
                detection.kind === 'key' || detection.kind === 'master' ? (
                  <button
                    type="button"
                    onClick={commitDetected}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-hive hover:text-hive-light"
                  >
                    <Plus size={12} /> Add
                  </button>
                ) : null
              }
            />

            <Card variant="outline" padding="sm">
              <div className="flex items-start gap-2.5 px-1">
                <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">
                  Keys are encrypted locally with AES-256-GCM and never leave this device.
                  The <strong className="text-text-primary">posting</strong> key covers voting and posting;
                  the <strong className="text-text-primary">active</strong> key is needed to move funds.
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
                disabled={
                  Object.keys(collected).length === 0 &&
                  detection.kind !== 'key' &&
                  detection.kind !== 'master'
                }
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
