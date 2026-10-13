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
  | 'tokenDetail'
  | 'contacts'
  | 'approveRequest';

export interface NavigationEntry {
  page: Page;
  params?: Record<string, any>;
}

// dApp operation types. Each one is a request a web page can make through
// window.signet (or the window.hive_keychain compatibility shim). Every one
// of these needs explicit user approval in the extension before anything is
// signed or broadcast.
export type DAppRequestType =
  | 'SIGN_TRANSACTION'
  | 'SIGN_BUFFER'
  | 'BROADCAST'
  | 'TRANSFER'
  | 'VOTE'
  | 'POST'
  | 'CUSTOM_JSON'
  | 'DELEGATE'
  | 'POWER_UP'
  | 'POWER_DOWN'
  | 'DECODE_MEMO'
  | 'ENCODE_MEMO'
  | 'ADD_ACCOUNT_AUTHORITY'
  | 'REMOVE_ACCOUNT_AUTHORITY'
  | 'WITNESS_VOTE'
  | 'PROXY'
  | 'UPDATE_PROPOSAL_VOTE'
  | 'CONVERT'
  | 'RECURRENT_TRANSFER'
  | 'SEND_TOKEN'
  | 'SIGNED_CALL';

// Internal extension messages (popup <-> background <-> content script)
export type InternalMessageType =
  | 'UNLOCK'
  | 'LOCK'
  | 'GET_STATUS'
  | 'REQUEST_HANDSHAKE'
  | 'GET_PENDING_REQUESTS'
  | 'REQUEST_RESPONSE'
  | 'ACTIVITY'
  | 'LOCKED'
  | 'PENDING_REQUESTS_CHANGED';

export type MessageType = DAppRequestType | InternalMessageType;

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
  pending?: boolean;
}

// A dApp request waiting for the user's decision. Stored in
// chrome.storage.session so it survives service worker restarts.
export interface DAppRequest {
  id: string;
  type: DAppRequestType;
  payload: any;
  origin: string;
  tabId: number | null;
  timestamp: number;
}

// Response delivered back to the dApp. Field names follow Hive Keychain so
// existing dApps work unchanged through the compatibility shim.
export interface DAppResponse {
  success: boolean;
  error: string | null;
  result: any;
  data: any;
  message: string;
  request_id: string;
  publicKey?: string;
  username?: string;
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
