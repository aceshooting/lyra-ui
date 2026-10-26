import type { LyraGenDiagnostic } from './types.js';

export const LYRA_GEN_FAILURE_CATEGORIES = Object.freeze([
  'syntax', 'identity', 'security', 'budget', 'catalog', 'accessibility', 'validation', 'lifecycle', 'internal'
] as const);
export type LyraGenFailureCategory = typeof LYRA_GEN_FAILURE_CATEGORIES[number];
/** Local observation only. The library never supplies source, paths, messages, identifiers or values. */
export type LyraGenFailureCallback = (categories: readonly LyraGenFailureCategory[]) => void | Promise<void>;

function categoryFor(code: string): LyraGenFailureCategory {
  if (code.startsWith('limit.') || code.endsWith('-limit') || code === 'source.bytes' || code === 'repair.limit') return 'budget';
  if (code.startsWith('identity.') || ['duplicate-id', 'invalid-id'].includes(code)) return 'identity';
  if (code.startsWith('security.') || ['json.key', 'json.prototype', 'json.accessor', 'json.cycle', 'action.unknown', 'binding.unknown', 'state.unauthorized', 'reference.unauthorized'].includes(code) || code.startsWith('forbidden-') || code.startsWith('unsafe-')) return 'security';
  if (code.startsWith('catalog.') || code === 'view.catalog' || code === 'props.unknown' || code === 'unknown-tag') return 'catalog';
  if (code.startsWith('a11y.')) return 'accessibility';
  if (code.startsWith('revision.') || code === 'reference.stale' || code === 'cancelled' || code === 'stream-closed') return 'lifecycle';
  if (code.startsWith('json.') || ['source.incomplete', 'source.json', 'expected-token', 'invalid-name', 'invalid-entity', 'invalid-unicode', 'invalid-json-unicode', 'mismatched-tag', 'unclosed-tag', 'invalid-input', 'attribute-separator', 'duplicate-attribute', 'duplicate-json-key', 'duplicate-text', 'expected-attribute-value', 'expected-json-key', 'invalid-json', 'invalid-json-string', 'mismatched-close', 'mixed-content', 'nonfinite-number', 'raw-less-than', 'trailing-content', 'unfinished-attribute', 'unfinished-element', 'unfinished-json', 'unfinished-json-number', 'unfinished-json-string', 'unfinished-tag'].includes(code)) return 'syntax';
  if (['invalid-action', 'invalid-bindings', 'invalid-slot', 'invalid-text', 'invalid-context'].includes(code)) return 'validation';
  if (['schema.', 'view.', 'node.', 'props.', 'children.', 'binding.', 'action.', 'state.', 'snapshot.', 'patch.', 'pointer.', 'repair.'].some(prefix => code.startsWith(prefix))) return 'validation';
  return 'internal';
}

/** Stable unique categories only; codes and all other diagnostic fields stay at the caller. */
export function summarizeFailureCategories(diagnostics: readonly LyraGenDiagnostic[]): readonly LyraGenFailureCategory[] {
  const found = new Set<LyraGenFailureCategory>();
  try {
    if (!Array.isArray(diagnostics)) return Object.freeze(['internal']);
    const length = Math.min(100, diagnostics.length);
    if (diagnostics.length > length) found.add('budget');
    for (let index = 0; index < length; index++) {
      const itemDescriptor = Object.getOwnPropertyDescriptor(diagnostics, String(index));
      const item: unknown = itemDescriptor && 'value' in itemDescriptor ? itemDescriptor.value : undefined;
      const codeDescriptor = item !== null && typeof item === 'object' ? Object.getOwnPropertyDescriptor(item, 'code') : undefined;
      const code: unknown = codeDescriptor && 'value' in codeDescriptor ? codeDescriptor.value : undefined;
      found.add(typeof code === 'string' ? categoryFor(code) : 'internal');
    }
  } catch { found.add('internal'); }
  return Object.freeze(LYRA_GEN_FAILURE_CATEGORIES.filter(category => found.has(category)));
}

/** Opt-in observation without awaiting the observer; failures cannot interrupt the caller. */
export function notifyFailureCategories(diagnostics: readonly LyraGenDiagnostic[], callback?: LyraGenFailureCallback): void {
  if (typeof callback !== 'function') return;
  try { void Promise.resolve(callback(summarizeFailureCategories(diagnostics))).catch(() => undefined); } catch { /* Observation cannot interrupt a failure boundary. */ }
}
