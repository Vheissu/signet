/**
 * Message handler for the background service worker.
 *
 * IMPORTANT: This file must NOT import @hiveio/dhive or any library
 * that uses eval(), as eval is blocked by MV3 Content Security Policy
 * in service workers.
 *
 * All signing and broadcasting happens in the popup. The background only
 * manages session state, queues dApp requests, opens the approval window
 * and routes the user's decision back to the right tab.
 */

import { decryptFromString } from '@/core/crypto/encryption';
import { isDAppRequestType } from '@/core/dapp/requests';
import type { DAppRequest, DAppResponse, ExtensionMessage, ExtensionResponse } from '@/core/types';

const PENDING_KEY = 'pendingRequests';
const WINDOW_KEY = 'requestWindowId';
const ACTIVITY_KEY = 'lastActivity';

const APPROVAL_WIDTH = 400;
const APPROVAL_HEIGHT = 640;

interface StoredRequest extends DAppRequest {
  /** The id the page used, so the content script can match the reply. */
  pageRequestId: string;
}

function isExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return !!sender.url && sender.url.startsWith(chrome.runtime.getURL(''));
}

function extensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return '0.0.0';
  }
}

export async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_STATUS':
      return handleGetStatus();

    case 'UNLOCK':
      if (!isExtensionPage(sender)) return { success: false, error: 'Not allowed' };
      return handleUnlock(message.payload);

    case 'LOCK':
      if (!isExtensionPage(sender)) return { success: false, error: 'Not allowed' };
      await lockWallet();
      return { success: true };

    case 'ACTIVITY':
      if (!isExtensionPage(sender)) return { success: false, error: 'Not allowed' };
      await touchActivity();
      return { success: true };

    case 'REQUEST_HANDSHAKE':
      return {
        success: true,
        result: { extension: 'signet', version: extensionVersion() },
      };

    case 'GET_PENDING_REQUESTS':
      if (!isExtensionPage(sender)) return { success: false, error: 'Not allowed' };
      return { success: true, result: await getPending() };

    case 'REQUEST_RESPONSE':
      if (!isExtensionPage(sender)) return { success: false, error: 'Not allowed' };
      return deliverResponse(message.payload?.requestId, message.payload?.response);

    default:
      if (isDAppRequestType(message.type)) {
        if (isExtensionPage(sender)) return { success: false, error: 'Not allowed' };
        return queueDAppRequest(message, sender);
      }
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

// --- Session / lock state ---

async function handleGetStatus(): Promise<ExtensionResponse> {
  try {
    const session = await chrome.storage.session.get('password');
    const stored = await chrome.storage.local.get('encryptedAccounts');
    return {
      success: true,
      result: {
        isInitialized: !!stored.encryptedAccounts,
        isLocked: !session.password,
        version: extensionVersion(),
      },
    };
  } catch {
    return { success: true, result: { isInitialized: false, isLocked: true } };
  }
}

async function handleUnlock(payload: { password: string }): Promise<ExtensionResponse> {
  try {
    const stored = await chrome.storage.local.get('encryptedAccounts');
    if (!stored.encryptedAccounts) {
      return { success: false, error: 'No accounts found' };
    }
    await decryptFromString(stored.encryptedAccounts, payload.password);
    await chrome.storage.session.set({ password: payload.password });
    await touchActivity();
    return { success: true };
  } catch {
    return { success: false, error: 'Incorrect password' };
  }
}

export async function lockWallet(): Promise<void> {
  try {
    await chrome.storage.session.remove('password');
  } catch {
    // session storage unavailable
  }
  try {
    await chrome.runtime.sendMessage({ type: 'LOCKED' });
  } catch {
    // no popup open to tell
  }
}

export async function touchActivity(): Promise<void> {
  try {
    await chrome.storage.session.set({ [ACTIVITY_KEY]: Date.now() });
  } catch {
    // ignore
  }
}

/**
 * Called once a minute from the alarm. Locks the wallet when either the
 * popup has been untouched for the configured number of minutes, or the
 * OS reports the user idle/locked for at least that long.
 */
export async function checkAutoLock(): Promise<void> {
  try {
    const session = await chrome.storage.session.get(['password', ACTIVITY_KEY]);
    if (!session.password) return;

    const settings = (await chrome.storage.local.get('settings')).settings;
    const minutes = Number(settings?.autoLockMinutes) > 0 ? Number(settings.autoLockMinutes) : 10;
    const limitMs = minutes * 60_000;

    const lastActivity = Number(session[ACTIVITY_KEY]) || 0;
    const inactiveFor = Date.now() - lastActivity;

    let idleState: chrome.idle.IdleState = 'active';
    try {
      idleState = await chrome.idle.queryState(Math.max(15, minutes * 60));
    } catch {
      // idle API unavailable
    }

    if (idleState === 'locked' || idleState === 'idle' || inactiveFor >= limitMs) {
      await lockWallet();
    }
  } catch (err) {
    console.error('[Signet] Auto-lock check failed:', err);
  }
}

// --- dApp request queue ---

async function getPending(): Promise<StoredRequest[]> {
  try {
    const result = await chrome.storage.session.get(PENDING_KEY);
    return Array.isArray(result[PENDING_KEY]) ? result[PENDING_KEY] : [];
  } catch {
    return [];
  }
}

async function setPending(requests: StoredRequest[]): Promise<void> {
  await chrome.storage.session.set({ [PENDING_KEY]: requests });
  try {
    await chrome.runtime.sendMessage({ type: 'PENDING_REQUESTS_CHANGED' });
  } catch {
    // popup not open
  }
}

function senderOrigin(sender: chrome.runtime.MessageSender): string {
  if (sender.origin) return sender.origin;
  try {
    return sender.url ? new URL(sender.url).origin : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function queueDAppRequest(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  if (!isDAppRequestType(message.type)) {
    return { success: false, error: 'Unsupported request' };
  }

  const stored = await chrome.storage.local.get('encryptedAccounts');
  if (!stored.encryptedAccounts) {
    const response: DAppResponse = {
      success: false,
      error: 'not_initialized',
      result: null,
      data: message.payload,
      message: 'Signet has not been set up yet. Open the extension to create a wallet.',
      request_id: message.requestId || '',
    };
    return { success: false, error: response.message, result: response };
  }

  const request: StoredRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    pageRequestId: message.requestId || '',
    type: message.type,
    payload: message.payload ?? {},
    origin: senderOrigin(sender),
    tabId: sender.tab?.id ?? null,
    timestamp: Date.now(),
  };

  const pending = await getPending();
  pending.push(request);
  await setPending(pending);
  await openApprovalWindow();

  return { success: true, pending: true, requestId: request.id };
}

async function openApprovalWindow(): Promise<void> {
  const session = await chrome.storage.session.get(WINDOW_KEY);
  const existingId = session[WINDOW_KEY];

  if (typeof existingId === 'number') {
    try {
      await chrome.windows.update(existingId, { focused: true, drawAttention: true });
      return;
    } catch {
      // window was closed; open a fresh one
    }
  }

  let left: number | undefined;
  let top: number | undefined;
  try {
    const current = await chrome.windows.getLastFocused();
    if (current.left !== undefined && current.width !== undefined) {
      left = Math.max(0, current.left + current.width - APPROVAL_WIDTH - 24);
    }
    if (current.top !== undefined) {
      top = Math.max(0, current.top + 72);
    }
  } catch {
    // fall back to the browser's default placement
  }

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL('index.html?mode=request'),
    type: 'popup',
    width: APPROVAL_WIDTH,
    height: APPROVAL_HEIGHT,
    focused: true,
    left,
    top,
  });

  if (win?.id !== undefined) {
    await chrome.storage.session.set({ [WINDOW_KEY]: win.id });
  }
}

async function deliverResponse(requestId: string, response: DAppResponse): Promise<ExtensionResponse> {
  if (!requestId) return { success: false, error: 'Missing request id' };

  const pending = await getPending();
  const request = pending.find((r) => r.id === requestId);
  if (!request) return { success: false, error: 'Unknown request' };

  const remaining = pending.filter((r) => r.id !== requestId);
  await setPending(remaining);

  if (request.tabId !== null) {
    try {
      await chrome.tabs.sendMessage(request.tabId, {
        target: 'signet-content',
        requestId: request.pageRequestId,
        response: { ...response, request_id: request.pageRequestId },
      });
    } catch {
      // tab navigated away or closed; nothing to deliver to
    }
  }

  return { success: true, result: { remaining: remaining.length } };
}

function cancelledResponse(request: StoredRequest): DAppResponse {
  return {
    success: false,
    error: 'user_cancel',
    result: null,
    data: request.payload,
    message: 'User cancelled the request',
    request_id: request.pageRequestId,
  };
}

/** The approval window was closed: everything still pending is rejected. */
export async function handleWindowClosed(windowId: number): Promise<void> {
  const session = await chrome.storage.session.get(WINDOW_KEY);
  if (session[WINDOW_KEY] !== windowId) return;

  await chrome.storage.session.remove(WINDOW_KEY);

  const pending = await getPending();
  if (pending.length === 0) return;
  await setPending([]);

  for (const request of pending) {
    if (request.tabId === null) continue;
    try {
      await chrome.tabs.sendMessage(request.tabId, {
        target: 'signet-content',
        requestId: request.pageRequestId,
        response: cancelledResponse(request),
      });
    } catch {
      // tab gone
    }
  }
}

/** A tab closed: drop its pending requests so the user is not asked for nothing. */
export async function handleTabClosed(tabId: number): Promise<void> {
  const pending = await getPending();
  const remaining = pending.filter((r) => r.tabId !== tabId);
  if (remaining.length !== pending.length) {
    await setPending(remaining);
  }
}
