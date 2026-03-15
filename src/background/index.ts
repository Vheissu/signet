/**
 * Signet Background Service Worker
 *
 * IMPORTANT: This file must NOT import @hiveio/dhive or any library
 * that uses eval(), as eval is blocked by MV3 Content Security Policy
 * in service workers.
 *
 * Handles:
 * - Extension lifecycle (install, startup)
 * - Auto-lock timer via chrome.alarms
 * - Message routing between popup, content scripts, and dApps
 */

import { handleMessage } from './message-handler';

// --- Extension Lifecycle ---

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Signet] Installed:', details.reason);
  chrome.alarms.create('autoLock', { periodInMinutes: 10 });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[Signet] Browser started');
});

// --- Auto-Lock ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autoLock') {
    const state = await chrome.idle.queryState(60);
    if (state === 'idle' || state === 'locked') {
      console.log('[Signet] Auto-locking due to inactivity');
      try {
        await chrome.storage.session.remove('password');
      } catch {
        // session storage might not be available
      }
      try {
        await chrome.runtime.sendMessage({ type: 'LOCKED' });
      } catch {
        // popup might not be open
      }
    }
  }
});

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => {
      sendResponse({
        success: false,
        error: err.message || 'Unknown error',
      });
    });
  return true;
});

// --- Activity Tracking ---

chrome.runtime.onConnect.addListener((port) => {
  chrome.alarms.create('autoLock', { periodInMinutes: 10 });
  port.onDisconnect.addListener(() => {
    chrome.alarms.create('autoLock', { periodInMinutes: 10 });
  });
});

console.log('[Signet] Background service worker initialized');
