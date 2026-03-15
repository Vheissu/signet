import { useState, useEffect } from 'react';
import { Vote, Users, ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react';
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
  const { getDecryptedKey } = useAccounts();

  const [tab, setTab] = useState<GovTab>('witnesses');
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
      const postingKey = await getDecryptedKey('posting');
      if (!postingKey) {
        addToast('Posting key required', 'error');
        setVotingWitness(null);
        return;
      }

      await broadcastWitnessVote(activeAccountName, witness, approve, postingKey);
      addToast(
        approve ? `Voted for @${witness}` : `Removed vote for @${witness}`,
        'success'
      );
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Vote failed', 'error');
    }
    setVotingWitness(null);
  }

  async function handleProposalVote(proposalId: number, approve: boolean) {
    if (!activeAccountName) return;
    setVotingProposal(proposalId);

    try {
      const postingKey = await getDecryptedKey('posting');
      if (!postingKey) {
        addToast('Posting key required', 'error');
        setVotingProposal(null);
        return;
      }

      await broadcastProposalVote(activeAccountName, [proposalId], approve, postingKey);
      addToast(approve ? 'Voted for proposal' : 'Removed vote', 'success');
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Vote failed', 'error');
    }
    setVotingProposal(null);
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
                      </div>
                    </div>
                    <Button
                      variant={w.voted ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => handleWitnessVote(w.owner, !w.voted)}
                      loading={votingWitness === w.owner}
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
