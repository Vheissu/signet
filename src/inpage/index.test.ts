/**
 * Tests the window.signet API and the Hive Keychain compatibility shim by
 * intercepting the postMessage calls the inpage script makes.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

type Sent = { type: string; payload: any; requestId: string };

let sent: Sent[] = [];
let signet: any;
let keychain: any;

function last(): Sent {
  return sent[sent.length - 1];
}

/** Simulate the content script answering the most recent request. */
function answer(response: any) {
  const { requestId } = last();
  window.dispatchEvent(
    new MessageEvent('message', {
      source: window as any,
      data: { target: 'signet-inpage', requestId, response },
    })
  );
}

beforeAll(async () => {
  vi.spyOn(window, 'postMessage').mockImplementation((data: any) => {
    if (data?.target === 'signet-content') sent.push(data);
  });
  await import('./index');
  signet = (window as any).signet;
  keychain = (window as any).hive_keychain;
});

beforeEach(() => {
  sent = [];
});

describe('window.signet', () => {
  it('is installed and exposes both APIs', () => {
    expect(signet.isInstalled()).toBe(true);
    expect(typeof keychain.requestHandshake).toBe('function');
  });

  it('formats transfer amounts with the currency', () => {
    signet.requestTransfer('alice', 'bob', '1', 'memo', 'HBD');
    expect(last().type).toBe('TRANSFER');
    expect(last().payload).toMatchObject({ from: 'alice', to: 'bob', amount: '1.000 HBD', memo: 'memo' });
  });

  it('resolves the promise with the relayed response', async () => {
    const promise = signet.requestVote('alice', 'bob', 'post', 10000);
    answer({ success: true, result: { id: 'tx' } });
    await expect(promise).resolves.toMatchObject({ success: true, result: { id: 'tx' } });
  });

  it('also calls an optional callback', async () => {
    const cb = vi.fn();
    const promise = signet.requestSignBuffer('alice', 'msg', 'posting', cb);
    answer({ success: true, result: 'sig' });
    await promise;
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ result: 'sig' }));
  });

  it('serialises object params for custom_json and signed calls', () => {
    signet.requestCustomJson('alice', 'id', { a: 1 }, true);
    expect(last().payload).toMatchObject({ json: '{"a":1}', role: 'active' });
    signet.requestSignedCall('alice', 'deposit', { amount: '1' }, 'active');
    expect(last().payload).toMatchObject({ params: '{"amount":"1"}', typeWif: 'active' });
  });

  it('keeps the unit from a delegation amount string', () => {
    signet.requestDelegation('alice', 'bob', '100.000 HP');
    expect(last().payload).toMatchObject({ amount: '100.000', unit: 'HP' });
    signet.requestDelegation('alice', 'bob', '1000.000000 VESTS');
    expect(last().payload).toMatchObject({ amount: '1000.000000', unit: 'VESTS' });
  });
});

describe('window.hive_keychain shim', () => {
  it('maps requestVote(account, permlink, author, weight) in Keychain order', () => {
    keychain.requestVote('alice', 'my-post', 'bob', 10000, () => {});
    expect(last().type).toBe('VOTE');
    expect(last().payload).toEqual({ voter: 'alice', author: 'bob', permlink: 'my-post', weight: 10000 });
  });

  it('maps requestCustomJson with a capitalised key name', () => {
    keychain.requestCustomJson('alice', 'ssc-mainnet-hive', 'Active', '{"x":1}', 'Buy', () => {});
    expect(last().payload).toMatchObject({ id: 'ssc-mainnet-hive', role: 'active', json: '{"x":1}', display: 'Buy' });
    keychain.requestCustomJson('alice', 'follow', 'Posting', '[]', '', () => {});
    expect(last().payload.role).toBe('posting');
  });

  it('maps requestSignBuffer including title and lowercases the key', () => {
    keychain.requestSignBuffer('alice', 'challenge', 'Posting', () => {}, undefined, 'Login');
    expect(last().type).toBe('SIGN_BUFFER');
    expect(last().payload).toEqual({ username: 'alice', message: 'challenge', role: 'posting', title: 'Login' });
  });

  it('allows a null account for signBuffer so the user can pick', () => {
    keychain.requestSignBuffer(null, 'challenge', 'Posting', () => {});
    expect(last().payload.username).toBeNull();
  });

  it('maps requestTransfer with enforce flag', () => {
    keychain.requestTransfer('alice', 'bob', '2.5', '', 'HIVE', () => {}, true);
    expect(last().payload).toMatchObject({ amount: '2.500 HIVE', enforce: true });
  });

  it('maps requestDelegation with the unit argument', () => {
    keychain.requestDelegation('alice', 'bob', '50', 'HP', () => {});
    expect(last().payload).toEqual({ delegator: 'alice', delegatee: 'bob', amount: '50', unit: 'HP' });
  });

  it('maps requestPowerDown as Hive Power', () => {
    keychain.requestPowerDown('alice', '10', () => {});
    expect(last().type).toBe('POWER_DOWN');
    expect(last().payload).toEqual({ account: 'alice', amount: '10', unit: 'HP' });
  });

  it('maps requestUpdateProposalVote with stringified ids and extensions', () => {
    keychain.requestUpdateProposalVote('alice', '[1,2]', true, '[]', () => {});
    expect(last().payload).toEqual({ voter: 'alice', proposal_ids: [1, 2], approve: true, extensions: [] });
  });

  it('maps requestVerifyKey to a memo decode and requestEncodeMessage to encode', () => {
    keychain.requestVerifyKey('alice', '#enc', 'Memo', () => {});
    expect(last().type).toBe('DECODE_MEMO');
    expect(last().payload).toMatchObject({ username: 'alice', memo: '#enc', role: 'memo' });
    keychain.requestEncodeMessage('alice', 'bob', 'hi', 'Memo', () => {});
    expect(last().type).toBe('ENCODE_MEMO');
    expect(last().payload).toMatchObject({ receiver: 'bob', message: 'hi' });
  });

  it('maps requestBroadcast and requestSignTx roles', () => {
    keychain.requestBroadcast('alice', [['vote', {}]], 'Posting', () => {});
    expect(last().type).toBe('BROADCAST');
    expect(last().payload.role).toBe('posting');
    keychain.requestSignTx('alice', { operations: [] }, 'Active', () => {});
    expect(last().type).toBe('SIGN_TRANSACTION');
    expect(last().payload.role).toBe('active');
  });

  it('maps requestConversion to the collateralized flag', () => {
    keychain.requestConversion('alice', '5', true, () => {});
    expect(last().payload).toEqual({ owner: 'alice', amount: '5.000 HIVE', collateralized: true });
    keychain.requestConversion('alice', '5', false, () => {});
    expect(last().payload).toEqual({ owner: 'alice', amount: '5.000 HBD', collateralized: false });
  });

  it('maps requestSendToken for Hive Engine', () => {
    keychain.requestSendToken('alice', 'bob', '1.5', 'thanks', 'LEO', () => {});
    expect(last().type).toBe('SEND_TOKEN');
    expect(last().payload).toEqual({ username: 'alice', to: 'bob', amount: '1.5', memo: 'thanks', currency: 'LEO' });
  });

  it('calls the handshake callback once the extension answers', async () => {
    const cb = vi.fn();
    keychain.requestHandshake(cb);
    expect(last().type).toBe('REQUEST_HANDSHAKE');
    answer({ success: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
