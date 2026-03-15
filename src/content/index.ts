/**
 * Signet Content Script
 *
 * Injected into web pages to bridge communication between
 * the inpage script (window.signet) and the background service worker.
 *
 * Communication flow:
 *   Web Page (window.signet) → window.postMessage → Content Script → chrome.runtime.sendMessage → Background
 *   Background → Content Script → window.postMessage → Web Page
 */

// Inject the inpage script into the web page
function injectInpageScript(): void {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inpage.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  } catch (err) {
    console.error('[Signet] Failed to inject inpage script:', err);
  }
}

// Listen for messages from the inpage script
window.addEventListener('message', async (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  const data = event.data;
  if (!data || data.target !== 'signet-content') return;

  try {
    // Forward to background service worker
    const response = await chrome.runtime.sendMessage({
      type: data.type,
      payload: data.payload,
      requestId: data.requestId,
    });

    // Send response back to inpage script
    window.postMessage(
      {
        target: 'signet-inpage',
        requestId: data.requestId,
        response,
      },
      '*'
    );
  } catch (err: any) {
    window.postMessage(
      {
        target: 'signet-inpage',
        requestId: data.requestId,
        response: {
          success: false,
          error: err.message || 'Extension communication failed',
        },
      },
      '*'
    );
  }
});

// Notify the page that Signet is available
window.postMessage(
  {
    target: 'signet-inpage',
    type: 'SIGNET_INSTALLED',
  },
  '*'
);

// Inject the inpage script
injectInpageScript();

console.log('[Signet] Content script loaded');
