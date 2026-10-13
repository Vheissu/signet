/**
 * Signet Background Service Worker
 *
 * IMPORTANT: This file must NOT import @hiveio/dhive or any library
 * that uses eval(), as eval is blocked by MV3 Content Security Policy
 * in service workers.
 *
 * Handles:
 * - Extension lifecycle (install, startup)
 * - Auto-lock via a one-minute alarm plus OS idle detection
 * - Message routing between popup, content scripts, and dApps
 * - The approval window for dApp requests
 */

import {
  handleMessage,
  checkAutoLock,
  touchActivity,
  handleWindowClosed,
  handleTabClosed,
} from './message-handler';

const AUTO_LOCK_ALARM = 'autoLockTick';

function ensureAlarm(): void {
  chrome.alarms.create(AUTO_LOCK_ALARM, { periodInMinutes: 1 });
}

// --- Extension Lifecycle ---

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Signet] Installed:', details.reason);
  ensureAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
});

ensureAlarm();

// --- Auto-Lock ---

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    checkAutoLock();
  }
});

chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'locked') {
    checkAutoLock();
  }
});

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => {
      sendResponse({
        success: false,
        error: err?.message || 'Unknown error',
      });
    });
  return true;
});

// --- Activity Tracking ---
// The popup opens a port while it is visible. Connect and disconnect both
// count as activity, so the idle clock starts when the popup closes.

chrome.runtime.onConnect.addListener((port) => {
  touchActivity();
  port.onDisconnect.addListener(() => {
    touchActivity();
  });
});

// --- Approval window / tab bookkeeping ---

chrome.windows.onRemoved.addListener((windowId) => {
  handleWindowClosed(windowId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  handleTabClosed(tabId);
});
