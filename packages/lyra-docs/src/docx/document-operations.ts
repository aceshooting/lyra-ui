import { normalizeDocxAction } from './commands.js';
import { ownDataRecord } from './own-data-record.js';
import type { DocxBatchEdit, DocxParagraphEdit, DocxRefusalCode, DocxResult, DocxRevision } from './types.js';

/**
 * Fragment read bounds. `blocks`/`text` cap one request (defaults `defaultBlocks`/`defaultText`),
 * `blockText` caps one block's text, `nodes` caps the XML nodes one request visits, `bodyBlocks`
 * caps the body's top-level block list, and `ids` caps retained block ids per revision.
 */
export const DOCX_FRAGMENT_LIMITS: Readonly<{
  blocks: number; defaultBlocks: number; text: number; defaultText: number; blockText: number;
  nodes: number; bodyBlocks: number; ids: number;
}> = Object.freeze({
  blocks: 64, defaultBlocks: 16, text: 32_768, defaultText: 8_192, blockText: 4_096,
  nodes: 20_000, bodyBlocks: 20_000, ids: 4_096,
});
/** Edit batch bounds: steps per batch, and XML nodes the rollback fingerprint may visit. */
export const DOCX_BATCH_LIMITS: Readonly<{ steps: number; fingerprintNodes: number }> = Object.freeze({
  steps: 32, fingerprintNodes: 300_000,
});

const paragraphEdits: ReadonlySet<string> = new Set(['paragraph-style', 'alignment', 'toggle-list', 'indent', 'line-spacing']);
const runEdits: ReadonlySet<string> = new Set(['font-family', 'font-size', 'text-color', 'highlight', 'clear-formatting']);
const toggles: ReadonlySet<string> = new Set(['bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript']);

export function isDocxParagraphEdit(edit: DocxBatchEdit): edit is DocxParagraphEdit {
  return typeof edit !== 'string' && paragraphEdits.has(edit.type);
}

/** A copied revision, or null when the value is not an exact revision record. */
export function normalizeDocxRevision(value: unknown): DocxRevision | null {
  const revision = ownDataRecord(value);
  if (!revision || Object.keys(revision).some(key => key !== 'documentId' && key !== 'value') ||
    typeof revision['documentId'] !== 'string' || !revision['documentId'].length || revision['documentId'].length > 128 ||
    typeof revision['value'] !== 'number' || !Number.isSafeInteger(revision['value']) || revision['value'] < 0) return null;
  return { documentId: revision['documentId'], value: revision['value'] };
}

const opaqueId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 128;
const boundedInteger = (value: unknown, minimum: number, maximum: number) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;

export interface NormalizedFragmentRequest {
  readonly start: number;
  readonly outlineItemId?: string;
  readonly maxBlocks: number;
  readonly maxText: number;
  readonly expectedRevision?: DocxRevision;
}
/** Validate and copy a fragment request before any engine read. */
export function normalizeFragmentRequest(value: unknown): DocxResult<NormalizedFragmentRequest> {
  const invalid: DocxResult<never> = Object.freeze({ ok: false, code: 'invalid-option' });
  const request = ownDataRecord(value ?? {});
  if (!request || Object.keys(request).some(key => !['start', 'outlineItemId', 'maxBlocks', 'maxText', 'expectedRevision'].includes(key))) return invalid;
  const { start, outlineItemId, maxBlocks, maxText, expectedRevision } = request;
  if (start !== undefined && outlineItemId !== undefined) return invalid;
  if (start !== undefined && !boundedInteger(start, 0, DOCX_FRAGMENT_LIMITS.bodyBlocks)) return invalid;
  if (outlineItemId !== undefined && !opaqueId(outlineItemId)) return invalid;
  if (maxBlocks !== undefined && !boundedInteger(maxBlocks, 1, DOCX_FRAGMENT_LIMITS.blocks)) return invalid;
  if (maxText !== undefined && !boundedInteger(maxText, 1, DOCX_FRAGMENT_LIMITS.text)) return invalid;
  const revision = expectedRevision === undefined ? undefined : normalizeDocxRevision(expectedRevision);
  if (revision === null) return invalid;
  return Object.freeze({ ok: true, value: Object.freeze({
    start: (start as number | undefined) ?? 0,
    ...(outlineItemId === undefined ? {} : { outlineItemId: outlineItemId as string }),
    maxBlocks: (maxBlocks as number | undefined) ?? DOCX_FRAGMENT_LIMITS.defaultBlocks,
    maxText: (maxText as number | undefined) ?? DOCX_FRAGMENT_LIMITS.defaultText,
    ...(revision ? { expectedRevision: revision } : {}),
  }) });
}

export interface NormalizedBatch {
  readonly steps: readonly Readonly<{ edit: DocxBatchEdit; target?: string }>[];
  readonly expectedRevision: DocxRevision;
}
export type DocxBatchRefusal = Readonly<{ ok: false; code: DocxRefusalCode; step: number | null }>;
export const batchRefusal = (code: DocxRefusalCode, step: number | null = null): DocxBatchRefusal => Object.freeze({ ok: false, code, step });

/**
 * Validate and copy a whole batch before anything runs: every step must be a supported formatting
 * edit within its own limits, and a targeted step must be a paragraph edit.
 */
export function normalizeDocxBatch(steps: unknown, options: unknown): Readonly<{ ok: true; value: NormalizedBatch }> | DocxBatchRefusal {
  try {
    const checked = ownDataRecord(options);
    if (!checked || Object.keys(checked).some(key => key !== 'expectedRevision')) return batchRefusal('invalid-option');
    const expectedRevision = normalizeDocxRevision(checked['expectedRevision']);
    if (!expectedRevision || !Array.isArray(steps) || Object.getPrototypeOf(steps) !== Array.prototype) return batchRefusal('invalid-option');
    const length = steps.length;
    if (length < 1) return batchRefusal('invalid-option');
    if (length > DOCX_BATCH_LIMITS.steps) return batchRefusal('resource-limit');
    const copied: Readonly<{ edit: DocxBatchEdit; target?: string }>[] = [];
    for (let index = 0; index < length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(steps, index);
      const step = descriptor && Object.hasOwn(descriptor, 'value') ? ownDataRecord(descriptor.value) : null;
      if (!step || Object.keys(step).some(key => key !== 'edit' && key !== 'target')) return batchRefusal('invalid-option', index);
      const action = normalizeDocxAction(step['edit']);
      if (!action.ok) return batchRefusal(action.code === 'unsupported' ? 'invalid-option' : action.code, index);
      const edit = action.value;
      if (typeof edit === 'string' ? !toggles.has(edit) : !paragraphEdits.has(edit.type) && !runEdits.has(edit.type)) return batchRefusal('unsupported', index);
      const target = step['target'];
      if (target !== undefined && (!opaqueId(target) || !isDocxParagraphEdit(edit as DocxBatchEdit))) return batchRefusal('invalid-option', index);
      copied.push(Object.freeze({ edit: edit as DocxBatchEdit, ...(target === undefined ? {} : { target: target as string }) }));
    }
    return Object.freeze({ ok: true, value: Object.freeze({ steps: Object.freeze(copied), expectedRevision }) });
  } catch { return batchRefusal('invalid-option'); }
}
