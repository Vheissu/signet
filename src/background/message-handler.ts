/**
 * Message handler for the background service worker.
 *
 * IMPORTANT: This file must NOT import @hiveio/dhive or any library
 * that uses eval(), as eval is blocked by MV3 Content Security Policy
 * in service workers.
 *
 * All blockchain operations (signing, broadcasting) are handled by the
 * popup. The background only manages session state and routes messages.
 */

import { decryptFromString } from '@/core/crypto/encryption';
import type { ExtensionMessage, ExtensionResponse, StoredAccount } from '@/core/types';

export async function handleMessage(
  message: ExtensionMessage & { origin?: string },
  _sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_STATUS':
      return handleGetStatus();

    case 'UNLOCK':
      return handleUnlock(message.payload);

    case 'LOCK':
      return handleLock();

    case 'REQUEST_HANDSHAKE':
      return { success: true, result: { extension: 'signet', version: '0.1.0' } };

    // All blockchain operations are forwarded to the popup
    case 'SIGN_BUFFER':
    case 'SIGN_TRANSACTION':
    case 'TRANSFER':
    case 'VOTE':
    case 'CUSTOM_JSON':
    case 'DELEGATE':
    case 'POWER_UP':
    case 'POWER_DOWN':
    case 'WITNESS_VOTE':
    case 'DECODE_MEMO':
    case 'ENCODE_MEMO':
    case 'CONVERT':
      return handleDAppRequest(message);

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

async function handleGetStatus(): Promise<ExtensionResponse> {
  try {
    const session = await chrome.storage.session.get('password');
    const stored = await chrome.storage.local.get('encryptedAccounts');
    return {
      success: true,
      result: {
        isInitialized: !!stored.encryptedAccounts,
        isLocked: !session.password,
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

    // Verify password by attempting decryption
    await decryptFromString(stored.encryptedAccounts, payload.password);

    // Store password in session
    await chrome.storage.session.set({ password: payload.password });

    // Reset auto-lock timer
    const settings = (await chrome.storage.local.get('settings')).settings;
    const lockMinutes = settings?.autoLockMinutes || 10;
    chrome.alarms.create('autoLock', { periodInMinutes: lockMinutes });

    return { success: true };
  } catch {
    return { success: false, error: 'Incorrect password' };
  }
}

async function handleLock(): Promise<ExtensionResponse> {
  try {
    await chrome.storage.session.remove('password');
  } catch {
    // ignore
  }
  return { success: true };
}

/**
 * Handle dApp requests by storing them for the popup to process.
 * The popup will pick these up and show a confirmation UI.
 */
async function handleDAppRequest(
  message: ExtensionMessage & { origin?: string }
): Promise<ExtensionResponse> {
  // Check if wallet is unlocked
  try {
    const session = await chrome.storage.session.get('password');
    if (!session.password) {
      return { success: false, error: 'Wallet is locked' };
    }
  } catch {
    return { success: false, error: 'Wallet is locked' };
  }

  // Store the pending request for the popup to handle
  const request = {
    id: message.requestId || `req_${Date.now()}`,
    type: message.type,
    payload: message.payload,
    origin: message.origin || 'unknown',
    timestamp: Date.now(),
  };

  try {
    const existing = await chrome.storage.session.get('pendingRequests');
    const pending = existing.pendingRequests || [];
    pending.push(request);
    await chrome.storage.session.set({ pendingRequests: pending });

    // Open popup for user confirmation (if not already open)
    // The popup will process pending requests on load
    return {
      success: true,
      result: { pending: true, requestId: request.id },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to queue request' };
  }
}
