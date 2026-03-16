import {
  User,
  Shield,
  Globe,
  Clock,
  Trash2,
  LogOut,
  ChevronRight,
  Key,
  Server,
  Fingerprint,
  Users,
} from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Card } from '@/popup/components/ui/Card';
import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { Modal } from '@/popup/components/ui/Modal';
import { Badge } from '@/popup/components/ui/Badge';
import { useStore } from '@/popup/store';
import { secureStorage } from '@/core/storage/secure-storage';
import { useState, useEffect } from 'react';
import {
  getBiometricSupport,
  isBiometricEnrolled,
  enrollBiometric,
  removeBiometric,
} from '@/core/biometric/webauthn';

export function Settings() {
  const settings = useStore((s) => s.settings);
  const accounts = useStore((s) => s.accounts);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const updateSettings = useStore((s) => s.updateSettings);
  const lock = useStore((s) => s.lock);
  const navigateTo = useStore((s) => s.navigateTo);
  const removeAccount = useStore((s) => s.removeAccount);
  const addToast = useStore((s) => s.addToast);

  const password = useStore((s) => s.password);
  const [showRpcModal, setShowRpcModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [newRpc, setNewRpc] = useState('');
  const [lockMinutes, setLockMinutes] = useState(String(settings.autoLockMinutes));

  // Biometric state
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioUnavailableReason, setBioUnavailableReason] = useState('');
  const [showBioConfirm, setShowBioConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      const support = await getBiometricSupport();
      setBioAvailable(support.available);
      setBioUnavailableReason(
        support.reason === 'no-prf-support'
          ? 'Requires WebAuthn PRF support in this browser'
          : support.reason === 'unsupported-browser'
            ? 'This browser does not support secure biometric unlock'
            : ''
      );
      if (support.available) {
        const enrolled = await isBiometricEnrolled();
        setBioEnrolled(enrolled);
      }
    })();
  }, []);

  const handleToggleBiometric = async () => {
    if (bioEnrolled) {
      setBioLoading(true);
      await removeBiometric();
      setBioEnrolled(false);
      addToast('Fingerprint unlock disabled', 'info');
      try {
        await chrome.storage.local.remove('biometric_dismissed');
      } catch {}
      setBioLoading(false);
    } else {
      if (!password) {
        addToast('Wallet must be unlocked with password first', 'error');
        return;
      }
      setShowBioConfirm(true);
    }
  };

  const handleConfirmBiometric = async () => {
    setShowBioConfirm(false);
    setBioLoading(true);
    const success = await enrollBiometric(password!);
    if (success) {
      setBioEnrolled(true);
      addToast('Fingerprint unlock enabled', 'success');
    } else {
      addToast('Failed to enable fingerprint unlock', 'error');
    }
    setBioLoading(false);
  };

  const handleAutoLockChange = (value: string) => {
    setLockMinutes(value);
    const minutes = parseInt(value, 10);
    if (minutes > 0 && minutes <= 120) {
      updateSettings({ autoLockMinutes: minutes });
    }
  };

  const handleAddRpc = () => {
    if (!newRpc.startsWith('http')) return;
    const nodes = [...settings.rpcNodes, newRpc];
    updateSettings({ rpcNodes: nodes });
    setNewRpc('');
    addToast('RPC node added', 'success');
  };

  const handleRemoveRpc = (url: string) => {
    const nodes = settings.rpcNodes.filter((n) => n !== url);
    if (nodes.length === 0) return;
    updateSettings({
      rpcNodes: nodes,
      activeRpc: nodes[0],
    });
    addToast('RPC node removed', 'info');
  };

  const handleClearAll = async () => {
    await secureStorage.clearAll();
    window.location.reload();
  };

  return (
    <PageContainer title="Settings" showBack>
      <div className="space-y-4">
        {/* Accounts Section */}
        <div>
          <SectionTitle>Accounts</SectionTitle>
          <Card variant="elevated" padding="none">
            <SettingsItem
              icon={<User size={16} />}
              label="Manage Accounts"
              value={`${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
              onClick={() => setShowAccountsModal(true)}
            />
            <SettingsItem
              icon={<Key size={16} />}
              label="Add Account"
              onClick={() => navigateTo('addAccount')}
            />
            <SettingsItem
              icon={<Users size={16} />}
              label="Contacts"
              onClick={() => navigateTo('contacts')}
            />
          </Card>
        </div>

        {/* Security Section */}
        <div>
          <SectionTitle>Security</SectionTitle>
          <Card variant="elevated" padding="none">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-text-tertiary" />
                <span className="text-sm text-text-primary">Auto-Lock (minutes)</span>
              </div>
              <input
                type="number"
                value={lockMinutes}
                onChange={(e) => handleAutoLockChange(e.target.value)}
                className="w-16 bg-surface-overlay rounded-lg px-2 py-1 text-sm text-text-primary text-center border border-border focus:outline-none focus:border-hive/50"
                min="1"
                max="120"
              />
            </div>
            <SettingsItem
              icon={<Shield size={16} />}
              label="Encryption"
              value="AES-256-GCM"
              badge={<Badge variant="success">Secure</Badge>}
            />
            {(bioAvailable || bioUnavailableReason) && (
              <div className="px-4 py-3 flex items-center justify-between border-t border-border/50">
                <div className="flex items-center gap-3">
                  <Fingerprint size={16} className="text-text-tertiary" />
                  <div>
                    <span className="text-sm text-text-primary">Fingerprint Unlock</span>
                    <p className="text-[10px] text-text-tertiary">
                      {bioAvailable
                        ? (bioEnrolled ? 'Touch ID is enabled' : 'Use Touch ID to unlock')
                        : bioUnavailableReason}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleBiometric}
                  disabled={bioLoading || !bioAvailable}
                  className={`relative w-10 h-5.5 rounded-full transition-colors ${
                    bioEnrolled ? 'bg-success' : 'bg-surface-overlay'
                  } ${bioLoading || !bioAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div
                    className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${
                      bioEnrolled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* Network Section */}
        <div>
          <SectionTitle>Network</SectionTitle>
          <Card variant="elevated" padding="none">
            <SettingsItem
              icon={<Server size={16} />}
              label="RPC Nodes"
              value={settings.activeRpc.replace('https://', '')}
              onClick={() => setShowRpcModal(true)}
            />
          </Card>
        </div>

        {/* Danger Zone */}
        <div>
          <SectionTitle>Danger Zone</SectionTitle>
          <Card variant="elevated" padding="none">
            <SettingsItem
              icon={<LogOut size={16} />}
              label="Lock Wallet"
              onClick={lock}
              className="text-warning"
            />
            <SettingsItem
              icon={<Trash2 size={16} />}
              label="Clear All Data"
              onClick={() => setShowClearModal(true)}
              className="text-error"
            />
          </Card>
        </div>

        {/* Version */}
        <p className="text-center text-xs text-text-tertiary pt-2 pb-4">
          Signet v0.1.0
        </p>
      </div>

      {/* RPC Modal */}
      <Modal isOpen={showRpcModal} onClose={() => setShowRpcModal(false)} title="RPC Nodes">
        <div className="space-y-3">
          {settings.rpcNodes.map((node) => (
            <div
              key={node}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                settings.activeRpc === node
                  ? 'border-hive/30 bg-hive/5'
                  : 'border-border bg-surface'
              }`}
            >
              <button
                onClick={() => updateSettings({ activeRpc: node })}
                className="flex-1 text-left text-sm text-text-primary truncate"
              >
                {node.replace('https://', '')}
              </button>
              {settings.rpcNodes.length > 1 && (
                <button
                  onClick={() => handleRemoveRpc(node)}
                  className="text-text-tertiary hover:text-error ml-2"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              value={newRpc}
              onChange={(e) => setNewRpc(e.target.value)}
              placeholder="https://api.example.com"
              className="flex-1"
            />
            <Button size="sm" onClick={handleAddRpc} disabled={!newRpc}>
              Add
            </Button>
          </div>
        </div>
      </Modal>

      {/* Accounts Modal */}
      <Modal
        isOpen={showAccountsModal}
        onClose={() => setShowAccountsModal(false)}
        title="Manage Accounts"
      >
        <div className="space-y-2">
          {accounts.map((account) => {
            const keyCount = Object.keys(account.keys).filter((k) => account.keys[k as keyof typeof account.keys]).length;
            return (
              <div
                key={account.username}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-surface border border-border/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    @{account.username}
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    {keyCount} key{keyCount !== 1 ? 's' : ''}: {Object.keys(account.keys).filter((k) => account.keys[k as keyof typeof account.keys]).join(', ')}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowAccountsModal(false);
                    navigateTo('editAccount', { username: account.username });
                  }}
                >
                  Edit
                </Button>
                {account.username !== activeAccountName && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      removeAccount(account.username);
                      addToast(`@${account.username} removed`, 'info');
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Biometric Confirmation Modal */}
      <Modal
        isOpen={showBioConfirm}
        onClose={() => setShowBioConfirm(false)}
        title="Enable Fingerprint Unlock?"
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Signet will use WebAuthn PRF to derive a decryption key from your platform authenticator each time you unlock.
          </p>
          <p className="text-sm text-text-secondary">
            The encrypted password stays on this device, but the key used to decrypt it is not stored alongside the ciphertext.
          </p>
          <p className="text-sm text-text-secondary">
            This still does not protect against active malware running inside your browser or extension context, so keep treating biometrics as convenience plus defense in depth, not as a replacement for device security.
          </p>
          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              onClick={() => setShowBioConfirm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmBiometric} className="flex-1">
              Enable Anyway
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear Data Modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear All Data"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            This will permanently delete all accounts and settings. This action
            cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowClearModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleClearAll} className="flex-1">
              Clear Everything
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-text-secondary tracking-wider uppercase mb-2 px-1">
      {children}
    </h3>
  );
}

function SettingsItem({
  icon,
  label,
  value,
  badge,
  onClick,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 ${
        onClick ? 'hover:bg-surface-overlay transition-colors cursor-pointer' : ''
      } ${className}`}
    >
      <span className="text-text-tertiary">{icon}</span>
      <span className="text-sm text-text-primary flex-1 text-left">{label}</span>
      {badge}
      {value && !badge && (
        <span className="text-xs text-text-tertiary">{value}</span>
      )}
      {onClick && <ChevronRight size={14} className="text-text-tertiary" />}
    </Wrapper>
  );
}
