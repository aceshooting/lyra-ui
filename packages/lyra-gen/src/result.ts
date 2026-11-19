import type { LyraGenResult } from './types.js';

/** A single validation failure for a whole value. */
export function failure<T>(code: string, message: string): LyraGenResult<T> {
  return { ok: false, diagnostics: [{ code, path: '', message, severity: 'error' }] };
}
