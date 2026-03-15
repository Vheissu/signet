/**
 * Signet Inpage Script
 *
 * Injected into web pages to provide the window.signet API.
 * Communicates with the content script via window.postMessage.
 *
 * Also provides backward-compatible window.hive_keychain API for
 * dApps that expect Hive Keychain.
 */

interface SignetResponse {
  success: boolean;
  result?: any;
  error?: string;
}

type ResponseCallback = (response: SignetResponse) => void;

const pendingRequests = new Map<string, ResponseCallback>();
let requestCounter = 0;
let isInstalled = false;

// Listen for responses from the content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;

  if (!data || data.target !== 'signet-inpage') return;

  if (data.type === 'SIGNET_INSTALLED') {
    isInstalled = true;
    window.dispatchEvent(new CustomEvent('signet_installed'));
    window.dispatchEvent(new CustomEvent('hive_keychain_installed')); // backward compat
    return;
  }

  if (data.requestId && data.response) {
    const callback = pendingRequests.get(data.requestId);
    if (callback) {
      pendingRequests.delete(data.requestId);
      callback(data.response);
    }
  }
});

function sendRequest(type: string, payload: any): Promise<SignetResponse> {
  return new Promise((resolve) => {
    const requestId = `signet_${++requestCounter}_${Date.now()}`;

    pendingRequests.set(requestId, resolve);

    // Timeout after 5 minutes
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        resolve({ success: false, error: 'Request timed out' });
      }
    }, 300000);

    window.postMessage(
      {
        target: 'signet-content',
        type,
        payload,
        requestId,
      },
      '*'
    );
  });
}

// --- Signet Public API ---

const signet = {
  isInstalled: () => isInstalled,

  requestHandshake(): Promise<SignetResponse> {
    return sendRequest('REQUEST_HANDSHAKE', {});
  },

  requestTransfer(
    from: string,
    to: string,
    amount: string,
    memo: string,
    currency: string
  ): Promise<SignetResponse> {
    return sendRequest('TRANSFER', {
      from,
      to,
      amount: `${parseFloat(amount).toFixed(3)} ${currency}`,
      memo,
    });
  },

  requestVote(
    voter: string,
    author: string,
    permlink: string,
    weight: number
  ): Promise<SignetResponse> {
    return sendRequest('VOTE', { voter, author, permlink, weight });
  },

  requestCustomJson(
    username: string,
    id: string,
    json: string,
    useActive: boolean = false
  ): Promise<SignetResponse> {
    return sendRequest('CUSTOM_JSON', { username, id, json, useActive });
  },

  requestSignBuffer(
    username: string,
    message: string,
    role: 'posting' | 'active' = 'posting'
  ): Promise<SignetResponse> {
    return sendRequest('SIGN_BUFFER', { username, message, role });
  },

  requestSignTransaction(
    username: string,
    tx: any,
    role: 'posting' | 'active' = 'active'
  ): Promise<SignetResponse> {
    return sendRequest('SIGN_TRANSACTION', { username, tx, role });
  },

  requestDelegation(
    delegator: string,
    delegatee: string,
    vestingShares: string
  ): Promise<SignetResponse> {
    return sendRequest('DELEGATE', {
      delegator,
      delegatee,
      vesting_shares: vestingShares,
    });
  },

  requestPowerUp(from: string, to: string, amount: string): Promise<SignetResponse> {
    return sendRequest('POWER_UP', { from, to, amount });
  },

  requestPowerDown(account: string, vestingShares: string): Promise<SignetResponse> {
    return sendRequest('POWER_DOWN', { account, vesting_shares: vestingShares });
  },

  requestWitnessVote(
    account: string,
    witness: string,
    approve: boolean
  ): Promise<SignetResponse> {
    return sendRequest('WITNESS_VOTE', { account, witness, approve });
  },

  requestDecodeMemo(username: string, memo: string): Promise<SignetResponse> {
    return sendRequest('DECODE_MEMO', { username, memo });
  },

  requestEncodeMemo(
    username: string,
    receiver: string,
    message: string
  ): Promise<SignetResponse> {
    return sendRequest('ENCODE_MEMO', { username, receiver, message });
  },

  requestConvert(owner: string, amount: string): Promise<SignetResponse> {
    return sendRequest('CONVERT', { owner, amount });
  },

  /**
   * VSC/Magi smart contract signed call.
   * Broadcasts a custom_json with the specified method and params.
   */
  requestSignedCall(
    username: string,
    method: string,
    params: string,
    typeWif: 'posting' | 'active' | 'memo' = 'posting'
  ): Promise<SignetResponse> {
    return sendRequest('SIGNED_CALL', { username, method, params, typeWif });
  },
};

// Expose on window
(window as any).signet = signet;

// Backward compatibility with Hive Keychain API
(window as any).hive_keychain = {
  requestHandshake: signet.requestHandshake,
  requestTransfer: (
    from: string,
    to: string,
    amount: string,
    memo: string,
    currency: string,
    callback: ResponseCallback
  ) => signet.requestTransfer(from, to, amount, memo, currency).then(callback),
  requestVote: (
    voter: string,
    author: string,
    permlink: string,
    weight: number,
    callback: ResponseCallback
  ) => signet.requestVote(voter, author, permlink, weight).then(callback),
  requestCustomJson: (
    username: string,
    id: string,
    role: string,
    json: string,
    _display: string,
    callback: ResponseCallback
  ) =>
    signet.requestCustomJson(username, id, json, role === 'active').then(callback),
  requestSignBuffer: (
    username: string,
    message: string,
    role: string,
    callback: ResponseCallback
  ) =>
    signet.requestSignBuffer(username, message, role as any).then(callback),
  requestDelegation: (
    delegator: string,
    delegatee: string,
    amount: string,
    _unit: string,
    callback: ResponseCallback
  ) => signet.requestDelegation(delegator, delegatee, amount).then(callback),
  requestWitnessVote: (
    account: string,
    witness: string,
    approve: boolean,
    callback: ResponseCallback
  ) => signet.requestWitnessVote(account, witness, approve).then(callback),
  requestSignedCall: (
    username: string,
    method: string,
    params: string,
    typeWif: string,
    callback: ResponseCallback
  ) =>
    signet.requestSignedCall(username, method, params, typeWif.toLowerCase() as any).then(callback),
};

console.log('[Signet] Inpage API initialized');
