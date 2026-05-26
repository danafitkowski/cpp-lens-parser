import { parseXer } from './parse-xer.js';

/**
 * Handle a Web Worker message. Exported for unit testing — the browser
 * entry below wires this to `self.addEventListener('message', ...)`.
 *
 * Message shape:  { type: 'parse-xer', text: string, opts?: object }
 * Reply shapes:   { type: 'done', model: ... }  |
 *                 { type: 'error', message: string }
 *
 * @param {{type: string, text?: string, opts?: object}} msg
 * @param {(reply: object) => void} post  Function that delivers a reply.
 */
export async function handleWorkerMessage(msg, post) {
  if (!msg || msg.type !== 'parse-xer') {
    post({ type: 'error', message: `Unknown message type: ${msg && msg.type}` });
    return;
  }
  try {
    const model = parseXer(msg.text || '', msg.opts || {});
    post({ type: 'done', model });
  } catch (e) {
    post({ type: 'error', message: String(e && e.message ? e.message : e) });
  }
}

// Browser entry — auto-wires when this module is loaded in a Web Worker.
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined') {
  self.addEventListener('message', (e) => {
    handleWorkerMessage(e.data, (m) => self.postMessage(m));
  });
}
