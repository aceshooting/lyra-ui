import { createBrowserDocxPort } from './browser-port.js';
import { createInternalDocxSession } from './session.js';
import type { DocxResult, DocxSession, DocxSessionOptions } from './types.js';

/**
 * Claim an empty, connected light-DOM mount for one experimental DOCX session.
 * Load the companion's docx/editor.css stylesheet before opening a document.
 * Removing or moving the mount destroys the session; reconnect creates a new one.
 * The optional document engine loads only when open() is called.
 */
export function createDocxSession(options: DocxSessionOptions): DocxResult<DocxSession> {
  if (!options || (options.locale !== undefined && typeof options.locale !== 'string') ||
      (options.translate !== undefined && typeof options.translate !== 'function')) {
    return { ok: false, code: 'invalid-option' };
  }
  return createInternalDocxSession(options, createBrowserDocxPort(options));
}
