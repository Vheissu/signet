import { useState, useEffect } from 'react';
import { Key, CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Input } from '@/popup/components/ui/Input';
import { Button } from '@/popup/components/ui/Button';
import { Card } from '@/popup/components/ui/Card';
import { Badge } from '@/popup/components/ui/Badge';
import { Avatar } from '@/popup/components/ui/Avatar';
import { useStore } from '@/popup/store';
import { getAccount } from '@/core/hive/client';
import { validatePrivateKey, identifyKeyRole } from '@/core/crypto/hive-keys';

const KEY_ROLES = ['posting', 'active', 'memo', 'owner'] as const;
type Role = (typeof KEY_ROLES)[number];

export function EditAccount() {
  const pageParams = useStore((s) => s.pageParams);
  const accounts = useStore((s) => s.accounts);
  const updateAccountKeys = useStore((s) => s.updateAccountKeys);
  const addToast = useStore((s) => s.addToast);
  const goBack = useStore((s) => s.goBack);

  const username: string = pageParams.username || '';
  const account = accounts.find((a) => a.username === username);

  const [accountData, setAccountData] = useState<any>(null);
  const [addingRole, setAddingRole] = useState<Role | null>(null);
  const [newKey, setNewKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Roles that already have keys stored
  const existingRoles = account
    ? (Object.keys(account.keys).filter((k) => account.keys[k as Role]) as Role[])
    : [];

  // Roles that are missing
  const missingRoles = KEY_ROLES.filter((r) => !existingRoles.includes(r));

  useEffect(() => {
    if (username) {
      getAccount(username).then((data) => {
        setAccountData(data);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    }
  }, [username]);

  const handleAddKey = async () => {
    if (!addingRole || !newKey || !accountData) return;

    setKeyError('');

    if (!validatePrivateKey(newKey)) {
      setKeyError('Invalid private key format');
      return;
    }

    const detected = identifyKeyRole(newKey, accountData);
    if (!detected) {
      setKeyError('This key does not match any role for this account');
      return;
    }

    if (detected !== addingRole) {
      setKeyError(`This is a ${detected} key, not a ${addingRole} key`);
      return;
    }

    setIsSaving(true);
    try {
      await updateAccountKeys(username, { [addingRole]: newKey });
      addToast(`${addingRole.charAt(0).toUpperCase() + addingRole.slice(1)} key added`, 'success');
      setAddingRole(null);
      setNewKey('');
    } catch (err: any) {
      setKeyError(err.message || 'Failed to save key');
    }
    setIsSaving(false);
  };

  const handleRemoveKey = async (role: Role) => {
    if (existingRoles.length <= 1) {
      addToast('Cannot remove the last key', 'error');
      return;
    }

    // To remove a key, we rebuild the account without it
    const { password, accounts: currentAccounts } = useStore.getState();
    if (!password) return;

    const current = currentAccounts.find((a) => a.username === username);
    if (!current) return;

    const updatedKeys = { ...current.keys };
    delete updatedKeys[role];

    const { encryptToString } = await import('@/core/crypto/encryption');
    const { secureStorage } = await import('@/core/storage/secure-storage');

    const updatedAccount = { username, keys: updatedKeys };
    const newAccounts = currentAccounts.map((a) => (a.username === username ? updatedAccount : a));
    const encrypted = await encryptToString(newAccounts, password);
    await secureStorage.setEncryptedAccounts(encrypted);

    useStore.setState({ accounts: newAccounts });
    addToast(`${role.charAt(0).toUpperCase() + role.slice(1)} key removed`, 'info');
  };

  if (!account) {
    return (
      <PageContainer title="Edit Account" showBack>
        <p className="text-sm text-text-secondary text-center py-12">Account not found</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer title={`@${username}`} showBack>
      <div className="space-y-5">
        {/* Account header */}
        <div className="flex items-center gap-3.5">
          <Avatar username={username} size="lg" />
          <div>
            <p className="text-lg font-bold text-text-primary">@{username}</p>
            <p className="text-xs text-text-secondary">
              {existingRoles.length} of {KEY_ROLES.length} keys configured
            </p>
          </div>
        </div>

        {/* Key status */}
        <div>
          <p className="text-[11px] font-semibold text-text-secondary tracking-widest uppercase mb-2.5 px-1">
            Keys
          </p>
          <div className="space-y-2">
            {KEY_ROLES.map((role) => {
              const hasKey = existingRoles.includes(role);
              return (
                <Card key={role} variant="elevated" padding="sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        hasKey ? 'bg-success/12' : 'bg-surface-overlay'
                      }`}>
                        {hasKey ? (
                          <CheckCircle size={14} className="text-success" />
                        ) : (
                          <XCircle size={14} className="text-text-tertiary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary capitalize">
                          {role} Key
                        </p>
                        <p className="text-[10px] text-text-tertiary">
                          {hasKey ? 'Encrypted and stored' : 'Not configured'}
                        </p>
                      </div>
                    </div>

                    {hasKey ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveKey(role)}
                        className="text-text-tertiary hover:text-error"
                      >
                        <Trash2 size={14} />
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setAddingRole(role);
                          setNewKey('');
                          setKeyError('');
                        }}
                        icon={<Plus size={12} />}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Add key form */}
        {addingRole && (
          <Card variant="gradient" padding="md">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-text-primary capitalize">
                  Add {addingRole} Key
                </h4>
                <Badge variant="hive">{addingRole}</Badge>
              </div>

              <Input
                type="password"
                value={newKey}
                onChange={(e) => {
                  setNewKey(e.target.value);
                  setKeyError('');
                }}
                placeholder={`Paste your ${addingRole} private key`}
                error={keyError}
                icon={<Key size={14} />}
                autoFocus
              />

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setAddingRole(null);
                    setNewKey('');
                    setKeyError('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="md"
                  onClick={handleAddKey}
                  loading={isSaving}
                  disabled={!newKey}
                  className="flex-1"
                >
                  Save Key
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Key role explanations */}
        <Card variant="outline" padding="sm">
          <p className="text-[11px] text-text-secondary leading-relaxed px-1">
            <strong className="text-text-primary">Posting</strong> — vote, comment, follow.{' '}
            <strong className="text-text-primary">Active</strong> — transfer, stake, delegate.{' '}
            <strong className="text-text-primary">Memo</strong> — encrypt/decrypt messages.{' '}
            <strong className="text-text-primary">Owner</strong> — change keys, recover account.
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}
