/**
 * Signet Inpage Script
 *
 * Runs in the page's main world (declared in the manifest with
 * `world: "MAIN"`) so it is present before any page script executes.
 * Exposes `window.signet` and a `window.hive_keychain` compatibility shim
 * so dApps written for Hive Keychain work without changes.
 *
 * Talks to the content script with window.postMessage. The content script
 * relays to the background worker, which opens the approval window.
 */

import { formatAssetAmount } from '@/core/dapp/requests';
import type { DAppRequestType, DAppResponse } from '@/core/types';

type ResponseCallback = (response: DAppResponse) => void;

const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

const pendingRequests = new Map<string, ResponseCallback>();
let requestCounter = 0;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.target !== 'signet-inpage') return;

  if (data.requestId && data.response) {
    const callback = pendingRequests.get(data.requestId);
    if (callback) {
      pendingRequests.delete(data.requestId);
      callback(data.response);
    }
  }
});

function sendRequest(type: DAppRequestType | 'REQUEST_HANDSHAKE', payload: any): Promise<DAppResponse> {
  return new Promise((resolve) => {
    const requestId = `signet_${++requestCounter}_${Date.now()}`;
    pendingRequests.set(requestId, resolve);

    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        resolve({
          success: false,
          error: 'timeout',
          result: null,
          data: payload,
          message: 'Request timed out',
          request_id: requestId,
        });
      }
    }, REQUEST_TIMEOUT_MS);

    window.postMessage({ target: 'signet-content', type, payload, requestId }, '*');
  });
}

function withCallback(promise: Promise<DAppResponse>, callback?: ResponseCallback): Promise<DAppResponse> {
  if (typeof callback === 'function') {
    promise.then(callback, (err) =>
      callback({
        success: false,
        error: 'exception',
        result: null,
        data: null,
        message: err?.message || 'Unexpected error',
        request_id: '',
      })
    );
  }
  return promise;
}

// --- Signet Public API ---

const signet = {
  isInstalled: () => true,
  version: '0.2.0',

  requestHandshake(callback?: ResponseCallback): Promise<DAppResponse> {
    return withCallback(sendRequest('REQUEST_HANDSHAKE', {}), callback);
  },

  requestTransfer(
    from: string | null,
    to: string,
    amount: string | number,
    memo: string,
    currency: string,
    callback?: ResponseCallback,
    enforce = false
  ) {
    return withCallback(
      sendRequest('TRANSFER', {
        from,
        to,
        amount: formatAssetAmount(amount, currency),
        memo: memo || '',
        enforce,
      }),
      callback
    );
  },

  requestVote(voter: string | null, author: string, permlink: string, weight: number, callback?: ResponseCallback) {
    return withCallback(sendRequest('VOTE', { voter, author, permlink, weight: Number(weight) }), callback);
  },

  requestPost(
    username: string | null,
    title: string,
    body: string,
    parent_permlink: string,
    parent_author: string,
    json_metadata: string | object,
    permlink: string,
    comment_options?: string | object | null,
    callback?: ResponseCallback
  ) {
    return withCallback(
      sendRequest('POST', {
        username,
        title,
        body,
        parent_permlink,
        parent_author,
        json_metadata: typeof json_metadata === 'string' ? json_metadata : JSON.stringify(json_metadata || {}),
        permlink,
        comment_options: comment_options || null,
      }),
      callback
    );
  },

  requestCustomJson(
    username: string | null,
    id: string,
    json: string | object,
    useActive = false,
    display?: string,
    callback?: ResponseCallback
  ) {
    return withCallback(
      sendRequest('CUSTOM_JSON', {
        username,
        id,
        json: typeof json === 'string' ? json : JSON.stringify(json),
        role: useActive ? 'active' : 'posting',
        display: display || '',
      }),
      callback
    );
  },

  requestSignBuffer(
    username: string | null,
    message: string,
    role: 'posting' | 'active' | 'memo' = 'posting',
    callback?: ResponseCallback,
    title?: string
  ) {
    return withCallback(sendRequest('SIGN_BUFFER', { username, message, role, title: title || '' }), callback);
  },

  requestSignTransaction(username: string | null, tx: any, role: 'posting' | 'active' = 'active', callback?: ResponseCallback) {
    return withCallback(sendRequest('SIGN_TRANSACTION', { username, tx, role }), callback);
  },

  requestBroadcast(username: string | null, operations: any[], role: 'posting' | 'active' = 'posting', callback?: ResponseCallback) {
    return withCallback(sendRequest('BROADCAST', { username, operations, role }), callback);
  },

  requestDelegation(
    delegator: string | null,
    delegatee: string,
    amount: string | number,
    unit: 'HP' | 'VESTS' = 'VESTS',
    callback?: ResponseCallback
  ) {
    const parsed = String(amount).trim().split(' ');
    const unitFromAmount = parsed[1]?.toUpperCase();
    return withCallback(
      sendRequest('DELEGATE', {
        delegator,
        delegatee,
        amount: parsed[0],
        unit: unitFromAmount === 'VESTS' || unitFromAmount === 'HP' ? unitFromAmount : unit,
      }),
      callback
    );
  },

  requestPowerUp(from: string | null, to: string, amount: string | number, callback?: ResponseCallback) {
    return withCallback(sendRequest('POWER_UP', { from, to, amount: formatAssetAmount(amount, 'HIVE') }), callback);
  },

  requestPowerDown(account: string | null, amount: string | number, unit: 'HP' | 'VESTS' = 'HP', callback?: ResponseCallback) {
    const parsed = String(amount).trim().split(' ');
    const unitFromAmount = parsed[1]?.toUpperCase();
    return withCallback(
      sendRequest('POWER_DOWN', {
        account,
        amount: parsed[0],
        unit: unitFromAmount === 'VESTS' || unitFromAmount === 'HP' ? unitFromAmount : unit,
      }),
      callback
    );
  },

  requestWitnessVote(account: string | null, witness: string, approve: boolean, callback?: ResponseCallback) {
    return withCallback(sendRequest('WITNESS_VOTE', { account, witness, approve: !!approve }), callback);
  },

  requestProxy(account: string | null, proxy: string, callback?: ResponseCallback) {
    return withCallback(sendRequest('PROXY', { account, proxy: proxy || '' }), callback);
  },

  requestUpdateProposalVote(
    voter: string | null,
    proposal_ids: number[] | string,
    approve: boolean,
    extensions: any[] = [],
    callback?: ResponseCallback
  ) {
    const ids = typeof proposal_ids === 'string' ? JSON.parse(proposal_ids) : proposal_ids;
    return withCallback(
      sendRequest('UPDATE_PROPOSAL_VOTE', { voter, proposal_ids: ids, approve: !!approve, extensions }),
      callback
    );
  },

  requestDecodeMemo(username: string | null, memo: string, role: 'memo' | 'posting' | 'active' = 'memo', callback?: ResponseCallback) {
    return withCallback(sendRequest('DECODE_MEMO', { username, memo, role }), callback);
  },

  requestEncodeMemo(
    username: string | null,
    receiver: string,
    message: string,
    role: 'memo' | 'posting' | 'active' = 'memo',
    callback?: ResponseCallback
  ) {
    return withCallback(sendRequest('ENCODE_MEMO', { username, receiver, message, role }), callback);
  },

  requestAddAccountAuthority(
    username: string | null,
    authorizedUsername: string,
    role: 'posting' | 'active',
    weight = 1,
    callback?: ResponseCallback
  ) {
    return withCallback(
      sendRequest('ADD_ACCOUNT_AUTHORITY', { username, authorizedUsername, role, weight: Number(weight) || 1 }),
      callback
    );
  },

  requestRemoveAccountAuthority(
    username: string | null,
    authorizedUsername: string,
    role: 'posting' | 'active',
    callback?: ResponseCallback
  ) {
    return withCallback(sendRequest('REMOVE_ACCOUNT_AUTHORITY', { username, authorizedUsername, role }), callback);
  },

  requestConvert(owner: string | null, amount: string | number, collateralized = false, callback?: ResponseCallback) {
    return withCallback(
      sendRequest('CONVERT', {
        owner,
        amount: formatAssetAmount(amount, collateralized ? 'HIVE' : 'HBD'),
        collateralized: !!collateralized,
      }),
      callback
    );
  },

  requestRecurrentTransfer(
    from: string | null,
    to: string,
    amount: string | number,
    currency: string,
    memo: string,
    recurrence: number,
    executions: number,
    callback?: ResponseCallback
  ) {
    return withCallback(
      sendRequest('RECURRENT_TRANSFER', {
        from,
        to,
        amount: formatAssetAmount(amount, currency),
        memo: memo || '',
        recurrence: Number(recurrence),
        executions: Number(executions),
      }),
      callback
    );
  },

  requestSendToken(
    username: string | null,
    to: string,
    amount: string | number,
    memo: string,
    currency: string,
    callback?: ResponseCallback
  ) {
    return withCallback(
      sendRequest('SEND_TOKEN', { username, to, amount: String(amount), memo: memo || '', currency }),
      callback
    );
  },

  /**
   * VSC/Magi smart contract signed call. Broadcasts a custom_json whose id
   * is the method name and whose body is the params.
   */
  requestSignedCall(
    username: string | null,
    method: string,
    params: string | object,
    typeWif: 'posting' | 'active' | 'memo' = 'posting',
    callback?: ResponseCallback
  ) {
    return withCallback(
      sendRequest('SIGNED_CALL', {
        username,
        method,
        params: typeof params === 'string' ? params : JSON.stringify(params),
        typeWif,
      }),
      callback
    );
  },
};

(window as any).signet = signet;

// --- Hive Keychain compatibility shim ---
//
// Argument order follows the Hive Keychain API exactly:
// https://github.com/hive-keychain/hive-keychain-extension/blob/master/documentation/README.md

const lower = (role: any, fallback: string) =>
  (typeof role === 'string' && role ? role : fallback).toLowerCase() as any;

const hive_keychain = {
  current_id: 1,
  requests: {},
  handshake_callback: null as null | (() => void),

  requestHandshake(callback?: () => void) {
    this.handshake_callback = callback || null;
    signet.requestHandshake().then(() => {
      if (typeof callback === 'function') callback();
    });
  },

  requestVerifyKey(account: string, message: string, key: string, callback: ResponseCallback) {
    signet.requestDecodeMemo(account, message, lower(key, 'memo'), callback);
  },

  requestEncodeMessage(username: string, receiver: string, message: string, key: string, callback: ResponseCallback) {
    signet.requestEncodeMemo(username, receiver, message, lower(key, 'memo'), callback);
  },

  requestSignBuffer(
    account: string | null,
    message: string,
    key: string,
    callback: ResponseCallback,
    _rpc?: string,
    title?: string
  ) {
    signet.requestSignBuffer(account, message, lower(key, 'posting'), callback, title);
  },

  requestAddAccountAuthority(
    account: string,
    authorizedUsername: string,
    role: string,
    weight: number,
    callback: ResponseCallback
  ) {
    signet.requestAddAccountAuthority(account, authorizedUsername, lower(role, 'posting'), weight, callback);
  },

  requestRemoveAccountAuthority(account: string, authorizedUsername: string, role: string, callback: ResponseCallback) {
    signet.requestRemoveAccountAuthority(account, authorizedUsername, lower(role, 'posting'), callback);
  },

  requestBroadcast(account: string | null, operations: any[], key: string, callback: ResponseCallback) {
    signet.requestBroadcast(account, operations, lower(key, 'posting'), callback);
  },

  requestSignTx(account: string | null, tx: any, key: string, callback: ResponseCallback) {
    signet.requestSignTransaction(account, tx, lower(key, 'active'), callback);
  },

  requestSignedCall(account: string | null, method: string, params: string, key: string, callback: ResponseCallback) {
    signet.requestSignedCall(account, method, params, lower(key, 'posting'), callback);
  },

  requestPost(
    account: string | null,
    title: string,
    body: string,
    parent_perm: string,
    parent_account: string,
    json_metadata: string,
    permlink: string,
    comment_options: string,
    callback: ResponseCallback
  ) {
    signet.requestPost(account, title, body, parent_perm, parent_account, json_metadata, permlink, comment_options, callback);
  },

  // NOTE: Keychain's order is (account, permlink, author, weight).
  requestVote(account: string | null, permlink: string, author: string, weight: number, callback: ResponseCallback) {
    signet.requestVote(account, author, permlink, weight, callback);
  },

  requestCustomJson(
    account: string | null,
    id: string,
    key: string,
    json: string,
    display_msg: string,
    callback: ResponseCallback
  ) {
    signet.requestCustomJson(account, id, json, lower(key, 'posting') === 'active', display_msg, callback);
  },

  requestTransfer(
    account: string | null,
    to: string,
    amount: string,
    memo: string,
    currency: string,
    callback: ResponseCallback,
    enforce = false
  ) {
    signet.requestTransfer(account, to, amount, memo, currency, callback, enforce);
  },

  requestSendToken(account: string | null, to: string, amount: string, memo: string, currency: string, callback: ResponseCallback) {
    signet.requestSendToken(account, to, amount, memo, currency, callback);
  },

  requestDelegation(username: string | null, delegatee: string, amount: string, unit: string, callback: ResponseCallback) {
    signet.requestDelegation(username, delegatee, amount, (unit || 'VESTS').toUpperCase() as 'HP' | 'VESTS', callback);
  },

  requestWitnessVote(username: string | null, witness: string, vote: boolean, callback: ResponseCallback) {
    signet.requestWitnessVote(username, witness, vote, callback);
  },

  requestProxy(username: string | null, proxy: string, callback: ResponseCallback) {
    signet.requestProxy(username, proxy, callback);
  },

  requestPowerUp(username: string | null, recipient: string, hive: string, callback: ResponseCallback) {
    signet.requestPowerUp(username, recipient, hive, callback);
  },

  requestPowerDown(username: string | null, hive_power: string, callback: ResponseCallback) {
    signet.requestPowerDown(username, hive_power, 'HP', callback);
  },

  requestUpdateProposalVote(
    username: string | null,
    proposal_ids: number[] | string,
    approve: boolean,
    extensions: any,
    callback: ResponseCallback
  ) {
    const ext = typeof extensions === 'string' ? JSON.parse(extensions || '[]') : extensions || [];
    signet.requestUpdateProposalVote(username, proposal_ids, approve, ext, callback);
  },

  requestRecurrentTransfer(
    username: string | null,
    to: string,
    amount: string,
    currency: string,
    memo: string,
    recurrence: number,
    executions: number,
    callback: ResponseCallback
  ) {
    signet.requestRecurrentTransfer(username, to, amount, currency, memo, recurrence, executions, callback);
  },

  requestConversion(username: string | null, amount: string, collaterized: boolean, callback: ResponseCallback) {
    signet.requestConvert(username, amount, collaterized, callback);
  },
};

(window as any).hive_keychain = hive_keychain;

// Let listeners know the API is ready. Both events fire so pages written
// for either wallet pick it up.
window.dispatchEvent(new CustomEvent('signet_installed'));
window.dispatchEvent(new CustomEvent('hive_keychain_installed'));
