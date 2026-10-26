import { parseJson } from './schema.js';
import { validateView } from './runtime.js';
import type { LyraGenCatalog, LyraGenLimits, LyraGenResult, LyraGenView } from './types.js';

export type LyraGenCompletionPolicy = 'reject' | 'close-envelope-eof';
export interface LyraGenCompletionOptions {
  /** Omitted means strict rejection. This policy never applies to Lyra Markup. */
  readonly policy?: LyraGenCompletionPolicy;
  readonly limits?: Partial<LyraGenLimits>;
}
export interface LyraGenCompletedView {
  readonly view: LyraGenView;
  readonly source: string;
  readonly completion: 'none' | 'closed-envelope';
}

/**
 * Optionally append one top-level object delimiter after an already closed JSON container.
 * Existing tokens are preserved; both paths use the same bounded parser and active catalog.
 */
export function completeJsonView(source: string, catalog: LyraGenCatalog, options: LyraGenCompletionOptions = {}): LyraGenResult<LyraGenCompletedView> {
  const strict = parseJson(source, options.limits);
  if (strict.ok) {
    const validated = validateView(strict.value, catalog, options);
    return validated.ok
      ? { ok: true, value: Object.freeze({ view: validated.value, source, completion: 'none' }), diagnostics: validated.diagnostics }
      : validated;
  }
  if (options.policy !== 'close-envelope-eof' || typeof source !== 'string'
    || strict.diagnostics.length !== 1 || strict.diagnostics[0]?.code !== 'json.syntax'
    || !source.trimStart().startsWith('{') || !['}', ']'].includes(source.trimEnd().at(-1) ?? '')) return strict;
  // Exactly one final envelope brace is authorized. Never finish tokens, members, tags or arrays.
  const completedSource = `${source}}`;
  const completed = parseJson(completedSource, options.limits);
  if (!completed.ok) return completed;
  const validated = validateView(completed.value, catalog, options);
  if (!validated.ok) return validated;
  return {
    ok: true,
    value: Object.freeze({ view: validated.value, source: completedSource, completion: 'closed-envelope' }),
    diagnostics: [{ code: 'recovery.envelope-closed', path: '', message: 'Completed one explicitly authorized final envelope delimiter.', severity: 'warning', source: { start: source.length, end: source.length } }]
  };
}
