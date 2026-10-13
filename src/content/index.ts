/**
 * Signet Content Script
 *
 * Runs in the isolated world. Relays requests from the inpage script
 * (window.signet) to the background worker, and relays the user's decision
 * back to the page once the approval window has been dealt with.
 *
 *   page  --postMessage-->  content  --runtime.sendMessage-->  background
 *   page  <--postMessage--  content  <--tabs.sendMessage-----  background
 *
 * The background answers the initial sendMessage straight away with
 * `{ pending: true }` for anything that needs approval, and delivers the
 * final answer later through tabs.sendMessage. This keeps working even if
 * the service worker is restarted while the approval window is open.
 */

function replyToPage(requestId: string, response: unknown): void {
  window.postMessage({ target: 'signet-inpage', requestId, response }, '*');
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  const data = event.data;
  if (!data || data.target !== 'signet-content' || !data.requestId) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: data.type,
      payload: data.payload,
      requestId: data.requestId,
    });

    if (response?.pending) return; // final answer arrives via onMessage below
    replyToPage(data.requestId, response);
  } catch (err: any) {
    replyToPage(data.requestId, {
      success: false,
      error: 'extension_unavailable',
      result: null,
      data: data.payload,
      message: err?.message || 'Signet is not reachable. Try reloading the page.',
      request_id: data.requestId,
    });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.target === 'signet-content' && message.requestId) {
    replyToPage(message.requestId, message.response);
  }
});
