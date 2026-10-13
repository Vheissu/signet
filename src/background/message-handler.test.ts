import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encryptToString } from '@/core/crypto/encryption';

// Extend the chrome mock from the test setup with the APIs the background uses.
const c = (globalThis as any).chrome;
const sentToTabs: any[] = [];
const createdWindows: any[] = [];
let windowCounter = 100;

c.runtime.id = 'test-ext';
c.runtime.getManifest = () => ({ version: '9.9.9' });
c.runtime.sendMessage = vi.fn(async () => ({}));
c.tabs = { sendMessage: vi.fn(async (tabId: number, msg: any) => { sentToTabs.push({ tabId, msg }); }) };
c.windows = {
  create: vi.fn(async (opts: any) => {
    const win = { id: ++windowCounter, ...opts };
    createdWindows.push(win);
    return win;
  }),
  update: vi.fn(async (id: number) => {
    if (!createdWindows.some((w) => w.id === id)) throw new Error('No window');
    return { id };
  }),
  getLastFocused: vi.fn(async () => ({ left: 0, top: 0, width: 1200, height: 800 })),
};

const { handleMessage, handleWindowClosed, handleTabClosed, checkAutoLock } = await import('./message-handler');

const pageSender = (tabId = 7): chrome.runtime.MessageSender =>
  ({ id: 'test-ext', url: 'https://peakd.com/post', origin: 'https://peakd.com', tab: { id: tabId } } as any);
const popupSender = (): chrome.runtime.MessageSender =>
  ({ id: 'test-ext', url: 'chrome-extension://test/index.html' } as any);

async function seedWallet(password = 'pw') {
  await c.storage.local.set({ encryptedAccounts: await encryptToString([], password) });
}

beforeEach(async () => {
  await c.storage.local.clear();
  await c.storage.session.clear();
  sentToTabs.length = 0;
  createdWindows.length = 0;
  vi.clearAllMocks();
});

describe('dApp request queue', () => {
  it('rejects requests when no wallet exists', async () => {
    const res = await handleMessage({ type: 'TRANSFER', payload: {}, requestId: 'p1' }, pageSender());
    expect(res.success).toBe(false);
    expect(res.result?.error).toBe('not_initialized');
  });

  it('queues a request, opens an approval window and answers pending', async () => {
    await seedWallet();
    const res = await handleMessage(
      { type: 'VOTE', payload: { voter: 'a' }, requestId: 'page-1' },
      pageSender(3)
    );
    expect(res).toMatchObject({ success: true, pending: true });
    expect(c.windows.create).toHaveBeenCalledTimes(1);
    expect(createdWindows[0].url).toContain('mode=request');

    const pending = await handleMessage({ type: 'GET_PENDING_REQUESTS' }, popupSender());
    expect(pending.result).toHaveLength(1);
    expect(pending.result[0]).toMatchObject({ type: 'VOTE', origin: 'https://peakd.com', tabId: 3 });
  });

  it('reuses the existing approval window for a second request', async () => {
    await seedWallet();
    await handleMessage({ type: 'VOTE', payload: {}, requestId: '1' }, pageSender());
    await handleMessage({ type: 'VOTE', payload: {}, requestId: '2' }, pageSender());
    expect(c.windows.create).toHaveBeenCalledTimes(1);
    expect(c.windows.update).toHaveBeenCalledTimes(1);
  });

  it('delivers the popup decision to the originating tab with the page request id', async () => {
    await seedWallet();
    await handleMessage({ type: 'TRANSFER', payload: { to: 'b' }, requestId: 'page-42' }, pageSender(9));
    const [req] = (await handleMessage({ type: 'GET_PENDING_REQUESTS' }, popupSender())).result;

    const res = await handleMessage(
      { type: 'REQUEST_RESPONSE', payload: { requestId: req.id, response: { success: true, result: 'ok' } } },
      popupSender()
    );
    expect(res.success).toBe(true);
    expect(sentToTabs).toHaveLength(1);
    expect(sentToTabs[0].tabId).toBe(9);
    expect(sentToTabs[0].msg).toMatchObject({
      target: 'signet-content',
      requestId: 'page-42',
      response: { success: true, result: 'ok', request_id: 'page-42' },
    });

    const remaining = await handleMessage({ type: 'GET_PENDING_REQUESTS' }, popupSender());
    expect(remaining.result).toHaveLength(0);
  });

  it('refuses privileged messages from web pages', async () => {
    const res = await handleMessage(
      { type: 'REQUEST_RESPONSE', payload: { requestId: 'x', response: {} } },
      pageSender()
    );
    expect(res.success).toBe(false);
    expect((await handleMessage({ type: 'GET_PENDING_REQUESTS' }, pageSender())).success).toBe(false);
    expect((await handleMessage({ type: 'LOCK' }, pageSender())).success).toBe(false);
  });

  it('refuses dApp operations sent from extension pages', async () => {
    await seedWallet();
    const res = await handleMessage({ type: 'TRANSFER', payload: {}, requestId: '1' }, popupSender());
    expect(res.success).toBe(false);
  });

  it('rejects everything pending when the approval window closes', async () => {
    await seedWallet();
    await handleMessage({ type: 'VOTE', payload: {}, requestId: 'a' }, pageSender(1));
    await handleMessage({ type: 'VOTE', payload: {}, requestId: 'b' }, pageSender(2));

    await handleWindowClosed(createdWindows[0].id);

    expect(sentToTabs).toHaveLength(2);
    expect(sentToTabs.map((s) => s.msg.response.error)).toEqual(['user_cancel', 'user_cancel']);
    expect((await handleMessage({ type: 'GET_PENDING_REQUESTS' }, popupSender())).result).toHaveLength(0);
  });

  it('ignores unrelated windows closing', async () => {
    await seedWallet();
    await handleMessage({ type: 'VOTE', payload: {}, requestId: 'a' }, pageSender(1));
    await handleWindowClosed(1);
    expect((await handleMessage({ type: 'GET_PENDING_REQUESTS' }, popupSender())).result).toHaveLength(1);
  });

  it('drops requests from a tab that closed', async () => {
    await seedWallet();
    await handleMessage({ type: 'VOTE', payload: {}, requestId: 'a' }, pageSender(1));
    await handleMessage({ type: 'VOTE', payload: {}, requestId: 'b' }, pageSender(2));
    await handleTabClosed(1);
    const pending = (await handleMessage({ type: 'GET_PENDING_REQUESTS' }, popupSender())).result;
    expect(pending).toHaveLength(1);
    expect(pending[0].tabId).toBe(2);
  });

  it('answers handshakes immediately with the manifest version', async () => {
    const res = await handleMessage({ type: 'REQUEST_HANDSHAKE', requestId: 'h' }, pageSender());
    expect(res).toMatchObject({ success: true, result: { extension: 'signet', version: '9.9.9' } });
    expect(res.pending).toBeUndefined();
  });
});

describe('unlock and auto-lock', () => {
  it('unlocks with the right password and rejects the wrong one', async () => {
    await seedWallet('correct');
    expect((await handleMessage({ type: 'UNLOCK', payload: { password: 'wrong' } }, popupSender())).success).toBe(false);
    expect((await handleMessage({ type: 'UNLOCK', payload: { password: 'correct' } }, popupSender())).success).toBe(true);
    const status = await handleMessage({ type: 'GET_STATUS' }, popupSender());
    expect(status.result).toMatchObject({ isInitialized: true, isLocked: false });
  });

  it('locks after the configured idle period', async () => {
    await seedWallet('pw');
    await c.storage.local.set({ settings: { autoLockMinutes: 5 } });
    await c.storage.session.set({ password: 'pw', lastActivity: Date.now() - 4 * 60_000 });

    await checkAutoLock();
    expect((await c.storage.session.get('password')).password).toBe('pw');

    await c.storage.session.set({ lastActivity: Date.now() - 6 * 60_000 });
    await checkAutoLock();
    expect((await c.storage.session.get('password')).password).toBeUndefined();
    expect(c.runtime.sendMessage).toHaveBeenCalledWith({ type: 'LOCKED' });
  });

  it('locks immediately when the OS reports the screen locked', async () => {
    await seedWallet('pw');
    await c.storage.session.set({ password: 'pw', lastActivity: Date.now() });
    c.idle.queryState = async () => 'locked';
    await checkAutoLock();
    expect((await c.storage.session.get('password')).password).toBeUndefined();
    c.idle.queryState = async () => 'active';
  });

  it('activity messages push the idle clock forward', async () => {
    await seedWallet('pw');
    await c.storage.session.set({ password: 'pw', lastActivity: 0 });
    await handleMessage({ type: 'ACTIVITY' }, popupSender());
    await checkAutoLock();
    expect((await c.storage.session.get('password')).password).toBe('pw');
  });
});
