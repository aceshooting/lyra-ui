import { unwrapOptionalPeerDefault } from '../../../internal/optional-peer-capabilities.js';
import type { ShikiRegexEngine } from './shiki-types.js';

/** Creates the opt-in Oniguruma engine using the reviewed packaged binary. No work runs until called. */
export function createShikiOnigurumaEngine(): Promise<ShikiRegexEngine> {
  return import('shiki/engine/oniguruma').then((module) => {
    const candidate = typeof module.createOnigurumaEngine === 'function'
      ? module
      : unwrapOptionalPeerDefault(module) as {
        createOnigurumaEngine?: (wasm: Promise<Response>) => Promise<ShikiRegexEngine>;
      } | null;
    const createEngine = candidate?.createOnigurumaEngine;
    if (typeof createEngine !== 'function') {
      throw new Error('Invalid optional peer shiki: an Oniguruma engine factory is required.');
    }
    // Validate the optional peer before fetching the packaged binary.
    return createEngine(fetch(new URL('./onig.wasm', import.meta.url))) as unknown as Promise<ShikiRegexEngine>;
  });
}
