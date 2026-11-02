import type { DocxEditorInstance, EditorCommand } from '@docx-editor.dev/core';
import { DOCX_BATCH_LIMITS } from './document-operations.js';
import type { DocxEngineBatchResult } from './engine-port.js';
import type { DocxRefusalCode, DocxResult } from './types.js';

type Package = ReturnType<NonNullable<DocxEditorInstance['surface']>['session']['currentPackage']>;
type Selection = Extract<Extract<EditorCommand, { type: 'setSelection' }>, { range: unknown }>['range'];
export interface DocxBatchPlanStep {
  readonly command: EditorCommand;
  /** Present for a targeted step: the caret moves to this paragraph's start first. */
  readonly paragraphId: string | null;
}
export interface DocxBatchRun {
  readonly result: DocxEngineBatchResult;
  /** The document may differ from its pre-batch state and no revert could be verified. */
  readonly fault: boolean;
}

const field = (value: unknown, key: string): unknown =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
const list = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];
const ordinal = (x: string, y: string) => x < y ? -1 : x > y ? 1 : 0;
const sorted = (values: Iterable<string>) => [...values].sort(ordinal);

/**
 * A structural digest of every XML part tree, the relationship table and the non-XML entry sizes.
 * Engine node identities are excluded, so a revert that rebuilds equal trees still matches. Null when
 * the package exceeds the node budget or has an unexpected shape.
 */
function packageFingerprint(pkg: Package, maxNodes: number = DOCX_BATCH_LIMITS.fingerprintNodes): string | null {
  let a = 0x811c9dc5, b = 0x9747b28c, nodes = 0;
  const mix = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      a = Math.imul(a ^ code, 0x01000193);
      b = Math.imul(b ^ code, 0x5bd1e995); b ^= b >>> 15;
    }
    // A separator that no UTF-16 code unit sequence above can produce keeps fields unambiguous.
    a = Math.imul(a ^ 0x1ffff, 0x01000193);
    b = Math.imul(b ^ 0x1ffff, 0x5bd1e995); b ^= b >>> 15;
  };
  try {
    if (!(pkg.parts instanceof Map) || !(pkg.partBytes instanceof Map) || !(pkg.relationships instanceof Map)) return null;
    for (const name of sorted(pkg.parts.keys())) {
      const part = pkg.parts.get(name);
      mix('part'); mix(name); mix(String(field(part, 'contentType')));
      const stack: unknown[] = [field(part, 'root')];
      while (stack.length) {
        const node = stack.pop();
        if (node === 'end') { mix('/'); continue; }
        if (++nodes > maxNodes) return null;
        if (field(node, 'kind') === 'textValue') { mix('#'); mix(String(field(node, 'value'))); continue; }
        const localName = field(node, 'localName'), namespace = field(node, 'namespaceUri');
        if (typeof localName !== 'string' || typeof namespace !== 'string') return null;
        mix('<'); mix(namespace); mix(localName);
        const attributes = list(field(node, 'attributes')).map(attribute =>
          `${String(field(attribute, 'namespaceUri'))}|${String(field(attribute, 'localName'))}=${String(field(attribute, 'value'))}`).sort(ordinal);
        for (const attribute of attributes) mix(attribute);
        stack.push('end');
        const children = list(field(node, 'children'));
        for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
      }
    }
    for (const owner of sorted(pkg.relationships.keys())) {
      mix('relationships'); mix(owner);
      for (const record of list(pkg.relationships.get(owner))) {
        const entries = record && typeof record === 'object' ? Object.entries(record).sort(([x], [y]) => ordinal(x, y)) : [];
        mix(entries.map(([key, value]) => `${key}=${String(value)}`).join('\u0000'));
      }
    }
    for (const name of sorted(pkg.partBytes.keys())) {
      if (pkg.parts.has(name)) continue;
      mix('bytes'); mix(name); mix(String(pkg.partBytes.get(name)?.byteLength));
    }
    return `${(a >>> 0).toString(36)}.${(b >>> 0).toString(36)}`;
  } catch { return null; }
}

const refusal = (code: DocxRefusalCode, step: number | null, rolledBack = false): DocxEngineBatchResult =>
  Object.freeze({ ok: false, code, step, rolledBack });

/**
 * Run a prepared plan synchronously inside one engine history group. On a refused step, undo each undo
 * unit the batch started, then require the package digest to match the pre-batch digest; a mismatch is a
 * fault. `guard` re-validates ownership around every write. Selection is restored when a step moved it.
 */
export function runEigenpalBatch(editor: DocxEditorInstance, steps: readonly DocxBatchPlanStep[],
  guard: () => DocxResult<void>, currentPackage: () => Package, selection: Selection | null): DocxBatchRun {
  const before = packageFingerprint(currentPackage());
  if (before === null) return { result: refusal('resource-limit', null), fault: false };
  const restoreSelection = () => {
    if (!selection) return;
    try {
      const command: EditorCommand = { type: 'setSelection', range: selection };
      if (editor.can(command).ok) editor.exec(command);
    } catch { /* The original caret is a courtesy; the document outcome is already settled. */ }
  };
  const group = editor.beginHistoryGroup();
  let units = 0, wrote = false, current = 0, failure: { code: DocxRefusalCode; step: number } | null = null;
  try {
    for (const [index, step] of steps.entries()) {
      current = index;
      if (step.paragraphId !== null) {
        const caret = { paragraphId: step.paragraphId, offset: 0 };
        const move: EditorCommand = { type: 'setSelection', range: { anchor: caret, head: { ...caret } } };
        if (!editor.can(move).ok || !editor.exec(move).ok) { failure = { code: 'stale-selection', step: index }; break; }
      }
      const ready = guard();
      if (!ready.ok) { failure = { code: ready.code, step: index }; break; }
      if (!editor.can(step.command, { historyGroup: group }).ok) { failure = { code: 'unsupported', step: index }; break; }
      const result = editor.exec(step.command, { historyGroup: group });
      if (result.ok && result.changed) {
        wrote = true;
        // Every write that did not extend the group opened its own undo unit.
        if (result.history?.kind !== 'extended') units++;
      }
      const after = guard();
      if (!result.ok) { failure = { code: 'unsupported', step: index }; break; }
      if (!after.ok) { failure = { code: after.code, step: index }; break; }
    }
  } catch {
    failure = { code: 'unsupported', step: current };
  } finally {
    try { group.end(); } catch { /* A closed group needs no ending. */ }
  }
  if (!failure) {
    restoreSelection();
    return { result: Object.freeze({ ok: true }), fault: false };
  }
  // A destroyed or faulted engine cannot be reverted; the session is already terminal.
  if (failure.code === 'destroyed' || failure.code === 'engine-failed') return { result: refusal(failure.code, failure.step), fault: false };
  try {
    for (let unit = 0; unit < units; unit++) {
      if (!editor.exec({ type: 'undo' }).ok) return { result: refusal('engine-failed', failure.step), fault: true };
    }
    if (packageFingerprint(currentPackage()) !== before) return { result: refusal('engine-failed', failure.step), fault: true };
  } catch { return { result: refusal('engine-failed', failure.step), fault: true }; }
  restoreSelection();
  return { result: refusal(failure.code, failure.step, wrote || units > 0), fault: false };
}
