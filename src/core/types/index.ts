// Key roles in the Hive blockchain
export type KeyRole = 'posting' | 'active' | 'memo' | 'owner';

// A stored account with encrypted keys
export interface StoredAccount {
  username: string;
  keys: {
    posting?: string; // encrypted WIF
    active?: string;  // encrypted WIF
    memo?: string;    // encrypted WIF
    owner?: string;   // encrypted WIF
  };
}

// Encrypted payload format (AES-256-GCM via Web Crypto API)
export interface EncryptedPayload {
  ct: string;  // ciphertext (base64)
  iv: string;  // initialization vector (base64)
  s: string;   // salt (base64)
}

// Extension settings
export interface Settings {
  autoLockMinutes: number;
  rpcNodes: string[];
  activeRpc: string;
  theme: 'dark' | 'light';
  currency: string;
  showTestnets: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoLockMinutes: 10,
  rpcNodes: [
    'https://api.hive.blog',
    'https://api.deathwing.me',
    'https://anyx.io',
    'https://api.openhive.network',
    'https://rpc.ausbit.dev',
  ],
  activeRpc: 'https://api.hive.blog',
  theme: 'dark',
  currency: 'USD',
  showTestnets: false,
};

// Navigation
export type Page =
  | 'welcome'
  | 'createPassword'
  | 'addAccount'
  | 'login'
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'staking'
  | 'governance'
  | 'history'
  | 'settings'
  | 'swap'
  | 'tokens'
  | 'delegation'
  | 'savings'
  | 'accountManager'
  | 'importKeys'
  | 'editAccount'
  | 'tokenDetail';

export interface NavigationEntry {
  page: Page;
  params?: Record<string, any>;
}

// Message types for extension messaging
export type MessageType =
  | 'UNLOCK'
  | 'LOCK'
  | 'GET_STATUS'
  | 'SIGN_TRANSACTION'
  | 'SIGN_BUFFER'
  | 'TRANSFER'
  | 'VOTE'
  | 'CUSTOM_JSON'
  | 'DELEGATE'
  | 'POWER_UP'
  | 'POWER_DOWN'
  | 'DECODE_MEMO'
  | 'ENCODE_MEMO'
  | 'REQUEST_HANDSHAKE'
  | 'ADD_ACCOUNT_AUTHORITY'
  | 'REMOVE_ACCOUNT_AUTHORITY'
  | 'WITNESS_VOTE'
  | 'PROXY'
  | 'CREATE_PROPOSAL'
  | 'UPDATE_PROPOSAL_VOTE'
  | 'REMOVE_PROPOSAL'
  | 'CONVERT'
  | 'RECURRENT_TRANSFER'
  | 'SAVINGS_DEPOSIT'
  | 'SAVINGS_WITHDRAW'
  | 'SIGNED_CALL';

export interface ExtensionMessage {
  type: MessageType;
  payload?: any;
  requestId?: string;
}

export interface ExtensionResponse {
  success: boolean;
  result?: any;
  error?: string;
  requestId?: string;
}

// Token (Hive Engine)
export interface HiveEngineToken {
  symbol: string;
  name: string;
  balance: string;
  stake?: string;
  pendingUnstake?: string;
  delegationsIn?: string;
  delegationsOut?: string;
  usdValue?: number;
  icon?: string;
  precision: number;
}

// Transaction history item
export interface TransactionRecord {
  id: string;
  type: string;
  timestamp: string;
  from: string;
  to: string;
  amount: string;
  memo?: string;
  block: number;
}

// Resource credits
export interface AccountResources {
  votingPower: number;     // percentage 0-100
  votingMana: number;      // current mana
  votingManaMax: number;   // max mana
  resourceCredits: number; // percentage 0-100
  rcMana: number;
  rcManaMax: number;
}

// Delegation info
export interface DelegationInfo {
  delegatee: string;
  delegator: string;
  vesting_shares: string;
  min_delegation_time: string;
}

// Witness info
export interface WitnessInfo {
  owner: string;
  votes: string;
  url: string;
  running_version: string;
  is_active: boolean;
  voted: boolean;
}

// Proposal info
export interface ProposalInfo {
  id: number;
  creator: string;
  receiver: string;
  subject: string;
  total_votes: string;
  status: string;
  start_date: string;
  end_date: string;
  daily_pay: string;
  voted: boolean;
}
