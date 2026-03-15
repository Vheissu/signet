import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, Key, Shield } from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Button } from '@/popup/components/ui/Button';
import { Card } from '@/popup/components/ui/Card';
import { Badge } from '@/popup/components/ui/Badge';
import { useStore } from '@/popup/store';
import { getAccount } from '@/core/hive/client';
import { validatePrivateKey, identifyKeyRole, deriveKeysFromPassword } from '@/core/crypto/hive-keys';
import { parsePasswordManagerCSV, getFormatName, isWifKey, type DetectedHiveAccount } from '@/core/import/csv-parser';
import type { StoredAccount } from '@/core/types';

export function ImportKeys() {
  const addAccount = useStore((s) => s.addAccount);
  const addToast = useStore((s) => s.addToast);
  const resetTo = useStore((s) => s.resetTo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'select' | 'importing'>('upload');
  const [detected, setDetected] = useState<DetectedHiveAccount[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    try {
      const text = await file.text();
      const accounts = parsePasswordManagerCSV(text);

      if (accounts.length === 0) {
        addToast('No Hive-related entries found in this file', 'info');
        setIsProcessing(false);
        return;
      }

      setDetected(accounts);
      setSelected(new Set(accounts.map((_, i) => i)));
      setStep('select');
    } catch (err: any) {
      addToast('Failed to parse CSV file', 'error');
    }

    setIsProcessing(false);

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    setStep('importing');
    setIsProcessing(true);

    let imported = 0;

    for (const idx of selected) {
      const entry = detected[idx];
      if (!entry.username) continue;

      try {
        // Verify account exists on chain
        const accountData = await getAccount(entry.username);
        if (!accountData) {
          addToast(`@${entry.username} not found on chain, skipped`, 'info');
          continue;
        }

        const keys: StoredAccount['keys'] = {};

        // If we have a master password, derive all keys from it
        if (entry.keys.master) {
          const derived = deriveKeysFromPassword(entry.username, entry.keys.master);
          for (const kp of derived) {
            const role = identifyKeyRole(kp.private, accountData);
            if (role) {
              keys[role] = kp.private;
            }
          }
        }

        // Add any directly-provided WIF keys
        for (const [role, wif] of Object.entries(entry.keys)) {
          if (role === 'master' || !wif) continue;
          if (isWifKey(wif) && validatePrivateKey(wif)) {
            const detectedRole = identifyKeyRole(wif, accountData);
            if (detectedRole) {
              keys[detectedRole] = wif;
            }
          }
        }

        if (Object.keys(keys).length > 0) {
          await addAccount({ username: entry.username, keys });
          imported++;
        } else {
          addToast(`No valid keys matched for @${entry.username}`, 'info');
        }
      } catch (err: any) {
        addToast(`Failed to import @${entry.username}`, 'error');
      }
    }

    setIsProcessing(false);

    if (imported > 0) {
      addToast(`Successfully imported ${imported} account${imported > 1 ? 's' : ''}`, 'success');
      resetTo('dashboard');
    } else {
      addToast('No accounts were imported', 'info');
      setStep('select');
    }
  };

  const toggleSelection = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <PageContainer title="Import from Password Manager" showBack>
      {step === 'upload' && (
        <div className="space-y-5">
          {/* Instructions */}
          <div className="text-center pt-4 pb-2">
            <div className="w-14 h-14 rounded-2xl bg-hive/10 flex items-center justify-center mx-auto mb-4">
              <Upload size={24} className="text-hive" />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-1.5">
              Import Your Hive Keys
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed max-w-[280px] mx-auto">
              Export your credentials as CSV from your password manager,
              then import them here. Signet will detect Hive-related entries automatically.
            </p>
          </div>

          {/* Supported managers */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-text-secondary tracking-widest uppercase px-1">
              Supported
            </p>
            <Card variant="elevated" padding="none">
              <ManagerRow
                name="1Password"
                instructions="Settings > Export > CSV Format"
              />
              <ManagerRow
                name="LastPass"
                instructions="Advanced Options > Export > CSV File"
              />
              <ManagerRow
                name="Bitwarden"
                instructions="Tools > Export Vault > CSV"
              />
              <ManagerRow
                name="Other"
                instructions="Any CSV with username + key fields"
                last
              />
            </Card>
          </div>

          {/* Upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            fullWidth
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            loading={isProcessing}
            icon={<FileText size={16} />}
          >
            Select CSV File
          </Button>

          {/* Security note */}
          <Card variant="outline" padding="sm">
            <div className="flex items-start gap-2.5">
              <Shield size={14} className="text-success flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Your CSV file is processed entirely on-device and never uploaded
                anywhere. It is read once and immediately discarded from memory.
              </p>
            </div>
          </Card>
        </div>
      )}

      {step === 'select' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-text-primary">
                Found {detected.length} Hive account{detected.length !== 1 ? 's' : ''}
              </p>
              <p className="text-[11px] text-text-tertiary">
                from {fileName}
              </p>
            </div>
            <Badge variant="hive">
              {getFormatName(detected[0]?.source ?? ('generic' as 'generic'))}
            </Badge>
          </div>

          {/* Account list */}
          <div className="space-y-2">
            {detected.map((entry, idx) => (
              <Card
                key={idx}
                variant={selected.has(idx) ? 'gradient' : 'elevated'}
                padding="sm"
                className="cursor-pointer"
                onClick={() => toggleSelection(idx)}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selected.has(idx)
                        ? 'bg-hive border-hive'
                        : 'border-border'
                    }`}
                  >
                    {selected.has(idx) && (
                      <CheckCircle size={12} className="text-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      @{entry.username || 'Unknown'}
                    </p>
                    <p className="text-[10px] text-text-tertiary truncate">
                      {entry.title}
                    </p>
                  </div>

                  {/* Keys found */}
                  <div className="flex gap-1 flex-shrink-0">
                    {Object.entries(entry.keys)
                      .filter(([, v]) => v)
                      .map(([role]) => (
                        <Badge key={role} variant="success" className="text-[9px]">
                          {role}
                        </Badge>
                      ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Import button */}
          <div className="pt-2 flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setStep('upload');
                setDetected([]);
              }}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              size="lg"
              onClick={handleImport}
              disabled={selected.size === 0}
              className="flex-1"
              icon={<Key size={16} />}
            >
              Import ({selected.size})
            </Button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 rounded-2xl bg-hive/10 flex items-center justify-center mb-4 animate-pulse-glow">
            <Key size={24} className="text-hive" />
          </div>
          <p className="text-sm font-semibold text-text-primary mb-1">
            Importing Accounts...
          </p>
          <p className="text-xs text-text-tertiary">
            Verifying keys on-chain and encrypting
          </p>
        </div>
      )}
    </PageContainer>
  );
}

function ManagerRow({
  name,
  instructions,
  last = false,
}: {
  name: string;
  instructions: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${last ? '' : 'border-b border-border/50'}`}>
      <span className="text-sm font-medium text-text-primary">{name}</span>
      <span className="text-[11px] text-text-tertiary">{instructions}</span>
    </div>
  );
}
