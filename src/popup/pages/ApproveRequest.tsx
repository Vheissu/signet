import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, KeyRound, Globe, ChevronDown } from 'lucide-react';
import { Button } from '@/popup/components/ui/Button';
import { Avatar } from '@/popup/components/ui/Avatar';
import { useStore } from '@/popup/store';
import { describeRequest } from '@/core/dapp/requests';
import { executeRequest, failure, MissingKeyError } from '@/core/dapp/execute';
import type { DAppRequest } from '@/core/types';

function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

export function ApproveRequest() {
  const pendingRequests = useStore((s) => s.pendingRequests);
  const accounts = useStore((s) => s.accounts);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const respondToRequest = useStore((s) => s.respondToRequest);
  const getDecryptedKey = useStore((s) => s.getDecryptedKey);
  const refreshAccountData = useStore((s) => s.refreshAccountData);
  const addToast = useStore((s) => s.addToast);

  const request: DAppRequest | undefined = pendingRequests[0];
  const description = useMemo(() => (request ? describeRequest(request) : null), [request]);

  const [chosenAccount, setChosenAccount] = useState<string>('');
  const [showPicker, setShowPicker] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  // Which account will sign. The dApp's choice wins when it is in the wallet.
  // A transfer without `enforce` (Keychain semantics) lets the user pick.
  const requestedUser = description?.username || null;
  const requestedInWallet = !!requestedUser && accounts.some((a) => a.username === requestedUser);
  const canSwitchAccount =
    !requestedUser || !requestedInWallet && request?.type === 'TRANSFER' && !request.payload?.enforce;
  const username = requestedInWallet ? requestedUser! : chosenAccount;
  const account = accounts.find((a) => a.username === username);
  const hasKey = !!account && !!description && !!account.keys[description.keyRole];

  useEffect(() => {
    setError('');
    setShowPicker(false);
    setChosenAccount(activeAccountName || accounts[0]?.username || '');
  }, [request?.id]);

  if (!request || !description) return null;

  const finish = async (response: Parameters<typeof respondToRequest>[1]) => {
    await respondToRequest(request.id, response);
  };

  const handleReject = () => finish(failure(request, 'user_cancel', 'User rejected the request'));

  const handleRejectAll = async () => {
    for (const r of pendingRequests) {
      await respondToRequest(r.id, failure(r, 'user_cancel', 'User rejected the request'));
    }
  };

  const handleApprove = async () => {
    if (!username) return;
    setIsWorking(true);
    setError('');
    try {
      const response = await executeRequest(request, username, getDecryptedKey);
      await finish(response);
      addToast(`${description.title} approved`, 'success');
      if (username === activeAccountName) refreshAccountData();
    } catch (err: any) {
      const message =
        err instanceof MissingKeyError
          ? `Add the ${err.role} key for @${err.username} in Settings to approve this.`
          : err?.message || 'The operation failed';
      setError(message);
      // A chain rejection is final for this request; let the page know.
      if (!(err instanceof MissingKeyError)) {
        await finish(failure(request, 'error', message));
      }
    }
    setIsWorking(false);
  };

  const accountMissing = !!requestedUser && !requestedInWallet && !canSwitchAccount;

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Origin */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-secondary">
            <Globe size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-text-tertiary">Request from</p>
            <p className="text-sm font-bold text-text-primary truncate">{hostOf(request.origin)}</p>
          </div>
          {pendingRequests.length > 1 && (
            <span className="text-[11px] font-semibold text-text-tertiary">
              1 of {pendingRequests.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* What */}
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">{description.title}</h1>
          <p className="text-sm text-text-secondary mt-0.5">{description.summary}</p>
        </div>

        {/* Who */}
        <div className="rounded-xl bg-surface border border-border">
          {accountMissing ? (
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-text-primary">@{requestedUser}</p>
              <p className="text-xs text-error mt-0.5">This account is not in Signet.</p>
            </div>
          ) : (
            <button
              type="button"
              disabled={!canSwitchAccount || accounts.length < 2}
              onClick={() => setShowPicker((v) => !v)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
            >
              {username && <Avatar username={username} size="sm" />}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-text-tertiary">Account</p>
                <p className="text-sm font-semibold text-text-primary truncate">
                  @{username || 'Select an account'}
                </p>
              </div>
              {canSwitchAccount && accounts.length > 1 && (
                <ChevronDown size={14} className="text-text-tertiary" />
              )}
            </button>
          )}

          {showPicker && (
            <div className="border-t border-border">
              {accounts.map((a) => (
                <button
                  key={a.username}
                  type="button"
                  onClick={() => {
                    setChosenAccount(a.username);
                    setShowPicker(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-elevated ${
                    a.username === username ? 'text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  <Avatar username={a.username} size="sm" />
                  <span className="text-sm font-medium">@{a.username}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border text-[11px]">
            <KeyRound size={12} className={hasKey ? 'text-success' : 'text-warning'} />
            <span className="text-text-secondary">
              Signs with the <span className="font-semibold text-text-primary">{description.keyRole}</span> key
            </span>
            {!hasKey && username && !accountMissing && (
              <span className="ml-auto text-warning font-semibold">not stored</span>
            )}
          </div>
        </div>

        {/* Details */}
        {description.fields.length > 0 && (
          <div className="rounded-xl bg-surface border border-border divide-y divide-border">
            {description.fields.map((field) => (
              <div key={field.label} className="px-4 py-2.5">
                <p className="text-[11px] text-text-tertiary mb-0.5">{field.label}</p>
                {field.code ? (
                  <pre className="text-[11px] leading-snug text-text-primary whitespace-pre-wrap break-all font-mono max-h-40 overflow-y-auto">
                    {field.value}
                  </pre>
                ) : (
                  <p className="text-sm font-medium text-text-primary break-words">{field.value}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {description.isSensitive && (
          <div className="flex items-start gap-2.5 rounded-xl bg-error/8 border border-error/20 px-4 py-3">
            <ShieldAlert size={15} className="text-error flex-shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              This operation can move funds or change who controls your account. Only approve it
              if you trust <span className="font-semibold text-text-primary">{hostOf(request.origin)}</span>.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-error">{error}</p>}
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 pt-3 border-t border-border space-y-2">
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={handleReject} disabled={isWorking} className="flex-1">
            Reject
          </Button>
          <Button
            size="lg"
            onClick={handleApprove}
            loading={isWorking}
            disabled={!username || accountMissing || !hasKey}
            className="flex-1"
          >
            Approve
          </Button>
        </div>
        {pendingRequests.length > 1 && (
          <button
            type="button"
            onClick={handleRejectAll}
            disabled={isWorking}
            className="w-full text-center text-[11px] text-text-tertiary hover:text-error py-1"
          >
            Reject all {pendingRequests.length} requests
          </button>
        )}
      </div>
    </div>
  );
}
