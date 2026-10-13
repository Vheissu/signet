import { useState, useEffect } from 'react';
import { Vote, Users, ExternalLink, ThumbsUp, ThumbsDown, UserCheck } from 'lucide-react';
import { Input } from '@/popup/components/ui/Input';
import { Header } from '@/popup/components/layout/Header';
import { BottomNav } from '@/popup/components/layout/BottomNav';
import { Card } from '@/popup/components/ui/Card';
import { Button } from '@/popup/components/ui/Button';
import { Badge } from '@/popup/components/ui/Badge';
import { Spinner } from '@/popup/components/ui/Spinner';
import { useStore } from '@/popup/store';
import { useAccounts } from '@/popup/hooks/useAccounts';
import {
  getWitnessesByVote,
  listProposals,
  listProposalVotes,
  broadcastWitnessVote,
  broadcastProposalVote,
  broadcastSetProxy,
  getAccount,
} from '@/core/hive/client';

type GovTab = 'witnesses' | 'proposals';

interface WitnessDisplay {
  owner: string;
  votes: string;
  url: string;
  running_version: string;
  voted: boolean;
}

interface ProposalDisplay {
  id: number;
  creator: string;
  subject: string;
  daily_pay: string;
  total_votes: string;
  status: string;
  voted: boolean;
}

export function Governance() {
  const activeAccountName = useStore((s) => s.activeAccountName);
  const activeAccountData = useStore((s) => s.activeAccountData);
  const addToast = useStore((s) => s.addToast);
  const refreshAccountData = useStore((s) => s.refreshAccountData);
  const { getDecryptedKey } = useAccounts();

  const [tab, setTab] = useState<GovTab>('witnesses');
  const currentProxy: string = (activeAccountData as any)?.proxy || '';
  const [proxyInput, setProxyInput] = useState('');
  const [showProxyForm, setShowProxyForm] = useState(false);
  const [isSettingProxy, setIsSettingProxy] = useState(false);
  const [witnesses, setWitnesses] = useState<WitnessDisplay[]>([]);
  const [proposals, setProposals] = useState<ProposalDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingWitness, setVotingWitness] = useState<string | null>(null);
  const [votingProposal, setVotingProposal] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [tab, activeAccountData]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'witnesses') {
        const result = await getWitnessesByVote('', 50);
        const votedWitnesses =
          (activeAccountData as any)?.witness_votes || [];

        setWitnesses(
          result.map((w: any) => ({
            owner: w.owner,
            votes: w.votes,
            url: w.url,
            running_version: w.running_version,
            voted: votedWitnesses.includes(w.owner),
          }))
        );
      } else {
        const [result, votedIds] = await Promise.all([
          listProposals(),
          activeAccountName
            ? listProposalVotes(activeAccountName)
            : Promise.resolve(new Set<number>()),
        ]);
        setProposals(
          (result || []).map((p: any) => ({
            id: p.id ?? p.proposal_id,
            creator: p.creator,
            subject: p.subject,
            daily_pay: p.daily_pay,
            total_votes: p.total_votes,
            status: p.status,
            voted: votedIds.has(p.id ?? p.proposal_id),
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load governance data:', err);
    }
    setLoading(false);
  }

  async function handleWitnessVote(witness: string, approve: boolean) {
    if (!activeAccountName) return;
    setVotingWitness(witness);

    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Witness votes need your active key. Add it in Settings.', 'error');
        setVotingWitness(null);
        return;
      }

      await broadcastWitnessVote(activeAccountName, witness, approve, activeKey);
      addToast(
        approve ? `Voted for @${witness}` : `Removed vote for @${witness}`,
        'success'
      );
      await refreshAccountData();
    } catch (err: any) {
      addToast(err.message || 'Vote failed', 'error');
    }
    setVotingWitness(null);
  }

  async function handleProposalVote(proposalId: number, approve: boolean) {
    if (!activeAccountName) return;
    setVotingProposal(proposalId);

    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Proposal votes need your active key. Add it in Settings.', 'error');
        setVotingProposal(null);
        return;
      }

      await broadcastProposalVote(activeAccountName, [proposalId], approve, activeKey);
      addToast(approve ? 'Voted for proposal' : 'Removed vote', 'success');
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Vote failed', 'error');
    }
    setVotingProposal(null);
  }

  async function handleSetProxy(proxy: string) {
    if (!activeAccountName) return;
    const clean = proxy.replace('@', '').trim().toLowerCase();
    setIsSettingProxy(true);
    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast('Setting a proxy needs your active key. Add it in Settings.', 'error');
        setIsSettingProxy(false);
        return;
      }
      if (clean) {
        const exists = await getAccount(clean);
        if (!exists) {
          addToast(`@${clean} not found`, 'error');
          setIsSettingProxy(false);
          return;
        }
      }
      await broadcastSetProxy(activeAccountName, clean, activeKey);
      addToast(clean ? `@${clean} now votes on your behalf` : 'Voting proxy removed', 'success');
      setProxyInput('');
      setShowProxyForm(false);
      await refreshAccountData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update proxy', 'error');
    }
    setIsSettingProxy(false);
  }

  return (
    <div className="flex flex-col h-full bg-bg">
      <Header />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Tab switcher */}
        <div className="flex bg-surface border-b border-border px-4 pt-3">
          <button
            onClick={() => setTab('witnesses')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'witnesses'
                ? 'text-hive border-hive'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            <Users size={14} />
            Witnesses
          </button>
          <button
            onClick={() => setTab('proposals')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'proposals'
                ? 'text-hive border-hive'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            <Vote size={14} />
            Proposals
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : tab === 'witnesses' ? (
            <div className="space-y-2">
              {/* Voting proxy */}
              <Card variant={currentProxy ? 'gradient' : 'elevated'} padding="sm">
                <div className="flex items-center gap-3">
                  <UserCheck size={16} className={currentProxy ? 'text-hive' : 'text-text-tertiary'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {currentProxy ? `@${currentProxy} votes for you` : 'No voting proxy'}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      {currentProxy
                        ? 'Your witness and proposal votes follow this account'
                        : 'Let another account cast witness votes on your behalf'}
                    </p>
                  </div>
                  {currentProxy ? (
                    <Button variant="danger" size="sm" onClick={() => handleSetProxy('')} loading={isSettingProxy}>
                      Clear
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setShowProxyForm(!showProxyForm)}>
                      Set
                    </Button>
                  )}
                </div>
                {showProxyForm && !currentProxy && (
                  <div className="flex gap-2 mt-3">
                    <Input
                      value={proxyInput}
                      onChange={(e) => setProxyInput(e.target.value)}
                      placeholder="Proxy username"
                      icon={<span className="text-text-tertiary font-bold text-sm">@</span>}
                    />
                    <Button
                      size="md"
                      onClick={() => handleSetProxy(proxyInput)}
                      loading={isSettingProxy}
                      disabled={!proxyInput.trim()}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </Card>

              {currentProxy && (
                <p className="text-[11px] text-text-tertiary px-1">
                  Direct witness votes are ignored while a proxy is set.
                </p>
              )}

              {witnesses.map((w, i) => (
                <Card key={w.owner} variant="elevated" padding="sm">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-text-tertiary w-5 text-center">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-text-primary">
                          @{w.owner}
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          v{w.running_version}
                        </span>
                        {w.url && (
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-text-tertiary hover:text-hive"
                            title="Witness page"
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                    <Button
                      variant={w.voted ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => handleWitnessVote(w.owner, !w.voted)}
                      loading={votingWitness === w.owner}
                      disabled={!!currentProxy}
                    >
                      {w.voted ? 'Unvote' : 'Vote'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {proposals.length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-8">
                  No active proposals
                </p>
              ) : (
                proposals.map((p) => (
                  <Card key={p.id} variant="elevated" padding="sm">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {p.subject}
                          </p>
                          <p className="text-[11px] text-text-tertiary mt-0.5">
                            by @{p.creator} &middot; {p.daily_pay}/day
                          </p>
                        </div>
                        <Badge variant="hive">#{p.id}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={p.voted ? 'danger' : 'secondary'}
                          size="sm"
                          onClick={() => handleProposalVote(p.id, !p.voted)}
                          loading={votingProposal === p.id}
                          icon={p.voted ? <ThumbsDown size={12} /> : <ThumbsUp size={12} />}
                          className="flex-1"
                        >
                          {p.voted ? 'Unvote' : 'Vote'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
