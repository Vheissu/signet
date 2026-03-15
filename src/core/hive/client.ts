import { Client, ExtendedAccount, DynamicGlobalProperties, PrivateKey } from '@hiveio/dhive';
import type { DelegationInfo, TransactionRecord } from '@/core/types';

const DEFAULT_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://anyx.io',
  'https://api.openhive.network',
  'https://rpc.ausbit.dev',
];

let client: Client | null = null;

export function getClient(nodes?: string[]): Client {
  if (!client) {
    client = new Client(nodes || DEFAULT_NODES, {
      timeout: 10000,
      failoverThreshold: 3,
    });
  }
  return client;
}

export function setNodes(nodes: string[]): void {
  client = new Client(nodes, {
    timeout: 10000,
    failoverThreshold: 3,
  });
}

export async function getAccount(username: string): Promise<ExtendedAccount | null> {
  const [account] = await getClient().database.getAccounts([username]);
  return account || null;
}

export async function getAccounts(usernames: string[]): Promise<ExtendedAccount[]> {
  return getClient().database.getAccounts(usernames);
}

export async function getDynamicGlobalProperties(): Promise<DynamicGlobalProperties> {
  return getClient().database.getDynamicGlobalProperties();
}

export async function getAccountHistory(
  username: string,
  start: number = -1,
  limit: number = 50
): Promise<TransactionRecord[]> {
  const history = await getClient().database.getAccountHistory(username, start, limit);

  return history
    .filter(([, op]: any) => {
      const type = op.op[0];
      return [
        'transfer',
        'transfer_to_vesting',
        'withdraw_vesting',
        'delegate_vesting_shares',
        'claim_reward_balance',
        'transfer_to_savings',
        'transfer_from_savings',
        'fill_convert_request',
        'fill_order',
      ].includes(type);
    })
    .map(([, op]: any) => {
      const [type, data] = op.op;
      return {
        id: op.trx_id,
        type,
        timestamp: op.timestamp,
        from: data.from || data.delegator || '',
        to: data.to || data.delegatee || '',
        amount: data.amount || data.vesting_shares || data.reward_hive || '',
        memo: data.memo || '',
        block: op.block,
      };
    })
    .reverse();
}

export async function getVestingDelegations(username: string): Promise<DelegationInfo[]> {
  return getClient().database.getVestingDelegations(username, '', 1000) as any;
}

export async function getWitnessesByVote(from: string, limit: number = 100) {
  return getClient().call('condenser_api', 'get_witnesses_by_vote', [from, limit]);
}

export async function getActiveWitnesses() {
  return getClient().call('condenser_api', 'get_active_witnesses', []);
}

export async function listProposals() {
  return getClient().call('condenser_api', 'list_proposals', [
    [-1],
    100,
    'by_total_votes',
    'ascending',
    'active',
  ]);
}

export async function getResourceCredits(username: string) {
  const result: any = await getClient().call('rc_api', 'find_rc_accounts', {
    accounts: [username],
  });
  return result.rc_accounts?.[0] || null;
}

export async function getCurrentMedianHistoryPrice() {
  return getClient().database.getCurrentMedianHistoryPrice();
}

export async function getRewardFund() {
  return getClient().call('condenser_api', 'get_reward_fund', ['post']);
}

// --- Broadcast Operations ---

export async function broadcastTransfer(
  from: string,
  to: string,
  amount: string,
  memo: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.transfer({ from, to, amount, memo }, key);
}

export async function broadcastVote(
  voter: string,
  author: string,
  permlink: string,
  weight: number,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.vote({ voter, author, permlink, weight }, key);
}

export async function broadcastTransferToVesting(
  from: string,
  to: string,
  amount: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.sendOperations(
    [['transfer_to_vesting', { from, to, amount }]],
    key
  );
}

export async function broadcastWithdrawVesting(
  account: string,
  vestingShares: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.sendOperations(
    [['withdraw_vesting', { account, vesting_shares: vestingShares }]],
    key
  );
}

export async function broadcastDelegateVestingShares(
  delegator: string,
  delegatee: string,
  vestingShares: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.delegateVestingShares(
    { delegator, delegatee, vesting_shares: vestingShares },
    key
  );
}

export async function broadcastWitnessVote(
  account: string,
  witness: string,
  approve: boolean,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.sendOperations(
    [
      [
        'account_witness_vote',
        { account, witness, approve },
      ],
    ],
    key
  );
}

export async function broadcastProposalVote(
  voter: string,
  proposalIds: number[],
  approve: boolean,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.sendOperations(
    [
      [
        'update_proposal_votes',
        { voter, proposal_ids: proposalIds, approve, extensions: [] },
      ],
    ],
    key
  );
}

export async function broadcastCustomJson(
  account: string,
  id: string,
  json: string,
  useActive: boolean,
  key: string
) {
  const privateKey = PrivateKey.fromString(key);
  return getClient().broadcast.sendOperations(
    [
      [
        'custom_json',
        {
          required_auths: useActive ? [account] : [],
          required_posting_auths: useActive ? [] : [account],
          id,
          json,
        },
      ],
    ],
    privateKey
  );
}

export async function broadcastTransferToSavings(
  from: string,
  to: string,
  amount: string,
  memo: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.sendOperations(
    [['transfer_to_savings', { from, to, amount, memo }]],
    key
  );
}

export async function broadcastTransferFromSavings(
  from: string,
  requestId: number,
  to: string,
  amount: string,
  memo: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  return getClient().broadcast.sendOperations(
    [['transfer_from_savings', { from, request_id: requestId, to, amount, memo }]],
    key
  );
}

export async function broadcastClaimRewards(
  account: string,
  rewardHive: string,
  rewardHbd: string,
  rewardVests: string,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.sendOperations(
    [
      [
        'claim_reward_balance',
        {
          account,
          reward_hive: rewardHive,
          reward_hbd: rewardHbd,
          reward_vesting_balance: rewardVests,
        },
      ],
    ],
    key
  );
}

export async function broadcastSetProxy(
  account: string,
  proxy: string,
  postingKey: string
) {
  const key = PrivateKey.fromString(postingKey);
  return getClient().broadcast.sendOperations(
    [['account_witness_proxy', { account, proxy }]],
    key
  );
}

export async function broadcastConvert(
  owner: string,
  amount: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  const requestId = Math.floor(Math.random() * 2 ** 32);
  return getClient().broadcast.sendOperations(
    [['convert', { owner, requestid: requestId, amount }]],
    key
  );
}

export async function broadcastCollateralizedConvert(
  owner: string,
  amount: string,
  activeKey: string
) {
  const key = PrivateKey.fromString(activeKey);
  const requestId = Math.floor(Math.random() * 2 ** 32);
  return getClient().broadcast.sendOperations(
    [['collateralized_convert', { owner, requestid: requestId, amount }]],
    key
  );
}
