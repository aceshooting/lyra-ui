import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { DocxEngineBatchResult } from './engine-port.js';
import type { OoxmlElement, OoxmlNode, OoxmlPackage } from '@docx-editor.dev/core/store';
import { DOCX_BATCH_LIMITS, DOCX_FRAGMENT_LIMITS } from './document-operations.js';
import { WORD_NS } from './ooxml.js';
import type { DocxMoveBlocksEdit, DocxRefusalCode, DocxResult } from './types.js';

const wordAttribute = (node: OoxmlElement, name: string) =>
  node.attributes.find(attribute => attribute.namespaceUri === WORD_NS && attribute.localName === name)?.value;
const rangeMarker = /^(bookmark|commentRange|moveFromRange|moveToRange|perm|customXml(?:Ins|Del|MoveFrom|MoveTo)Range)(Start|End)$/u;

interface RangeEvidence { region: number; start: boolean; end: boolean; reference: boolean }

/** A range may surround both exchanged regions, or travel intact inside either. */
function preservationRefusal(blocks: readonly OoxmlNode[], start: number, end: number, before: number): DocxRefusalCode | null {
  const ranges = new Map<string, RangeEvidence>();
  const fields: number[] = [];
  let visited = 0;
  for (const [index, block] of blocks.entries()) {
    const region = index >= start && index < end ? 1 :
      index >= Math.min(before, start) && index < Math.max(before, end) ? 2 : 0;
    const stack: OoxmlNode[] = [block];
    while (stack.length) {
      const node = stack.pop()!;
      if (++visited > DOCX_BATCH_LIMITS.fingerprintNodes) return 'resource-limit';
      if (node.kind === 'textValue') continue;
      if (node.namespaceUri === WORD_NS) {
        const name = node.localName;
        if (region === 1 && name === 'lock' && wordAttribute(node, 'val') !== 'unlocked') return 'unsupported';
        const marker = rangeMarker.exec(name);
        if (marker || name === 'commentReference') {
          const id = wordAttribute(node, 'id');
          if (!id) return 'unsupported';
          const key = (marker?.[1] ?? 'commentRange') + ':' + id;
          const evidence = ranges.get(key) ?? { region, start: false, end: false, reference: false };
          const point = marker ? (marker[2] === 'Start' ? 'start' : 'end') : 'reference';
          if (evidence.region !== region || (region !== 0 && (evidence[point] || (point === 'end' && !evidence.start)))) return 'unsupported';
          evidence[point] = true;
          ranges.set(key, evidence);
        } else if (name === 'fldChar') {
          const type = wordAttribute(node, 'fldCharType');
          if (type === 'begin') fields.push(region);
          else if (type === 'separate' || type === 'end') {
            if (fields.at(-1) !== region) return 'unsupported';
            if (type === 'end') fields.pop();
          }
        }
      }
      if (node.children.length > DOCX_BATCH_LIMITS.fingerprintNodes - visited - stack.length) return 'resource-limit';
      for (let child = node.children.length - 1; child >= 0; child--) stack.push(node.children[child]!);
    }
  }
  for (const evidence of ranges.values()) {
    if (evidence.region && evidence.start !== evidence.end) return 'unsupported';
  }
  return fields.some(region => region !== 0) ? 'unsupported' : null;
}

export type DocxPackageEdit = (current: OoxmlPackage) => OoxmlPackage;

/** Prepare one immutable body permutation, or null when the requested order is already in place. */
export function prepareBlockMove(pkg: OoxmlPackage, edit: DocxMoveBlocksEdit): DocxResult<DocxPackageEdit | null> {
  const part = pkg.parts.get(pkg.mainDocumentPart), root = part?.root;
  if (!part || root?.kind !== 'document') return { ok: false, code: 'unsupported' };
  const bodies = root.children.filter(child => child.kind === 'body');
  const body = bodies[0];
  if (bodies.length !== 1 || body?.kind !== 'body') return { ok: false, code: 'unsupported' };
  if (body.children.length > DOCX_FRAGMENT_LIMITS.bodyBlocks) return { ok: false, code: 'resource-limit' };
  // Preserve inter-element XML text in its original slots, just as fragments omit it from their indices.
  const isElement = (node: OoxmlNode) => node.kind !== 'textValue';
  const blocks = body.children.filter(isElement);
  const section = blocks.findIndex(node => node.namespaceUri === WORD_NS && node.localName === 'sectPr');
  if (section >= 0 && section !== blocks.length - 1) return { ok: false, code: 'unsupported' };
  const count = section < 0 ? blocks.length : section;
  const { start, end } = edit;
  if (end > count || edit.before > blocks.length) return { ok: false, code: 'invalid-option' };
  const before = Math.min(count, edit.before);
  if (before === start || before === end) return { ok: true, value: null };
  const refusal = preservationRefusal(blocks, start, end, before);
  if (refusal) return { ok: false, code: refusal };

  const left = Math.min(start, before), right = Math.max(end, before);
  const middle = before < start ? start : end;
  const ordered = [...blocks.slice(0, left), ...blocks.slice(middle, right), ...blocks.slice(left, middle), ...blocks.slice(right)];
  let position = 0;
  const children = Object.freeze(body.children.map(node => isElement(node) ? ordered[position++]! : node));
  const nextBody = Object.freeze({ ...body, children });
  const nextRoot = Object.freeze({ ...root, children: Object.freeze(root.children.map(node => node === body ? nextBody : node)) });
  const nextPart = Object.freeze({ ...part, root: nextRoot });
  return { ok: true, value: current => {
    if (current.parts.get(current.mainDocumentPart) !== part) throw new Error('Body changed before move');
    const parts = new Map(current.parts);
    parts.set(part.name, nextPart);
    return Object.freeze({ ...current, parts });
  } };
}

/** Only an unchanged native revision and tree can give a recoverable refusal. */
export function runBlockMove(editor: DocxEditorInstance, write: DocxPackageEdit,
  unchanged: () => DocxResult<void>, guard: () => DocxResult<void>): DocxEngineBatchResult {
  const refused = (code: DocxRefusalCode): DocxEngineBatchResult => ({ ok: false, code, step: 0, rolledBack: false });
  const surface = editor.surface;
  if (!surface) return refused('unsupported');
  const session = surface.session, revision = session.packageRevision(), part = session.part();
  let expectedPart: typeof part | undefined;
  let failure: DocxRefusalCode = 'unsupported';
  try {
    const result = surface.applyAutomationOps(() => {
      const ready = unchanged();
      if (!ready.ok) { failure = ready.code; return null; }
      return [];
    }, { kind: 'body' }, [current => {
      const next = write(current);
      expectedPart = next.parts.get(next.mainDocumentPart);
      return next;
    }]);
    const after = guard();
    if (after.ok && result.committed && !result.rejected && expectedPart && session.part() === expectedPart &&
      session.packageRevision() === revision + 1) return { ok: true };
    if (!after.ok) failure = after.code;
  } catch { /* The immutable part and revision distinguish a clean refusal from a committed write. */ }
  try {
    if (failure === 'destroyed' || failure === 'engine-failed') return refused(failure);
    if (editor.surface !== surface || surface.session !== session) return refused('engine-failed');
    // An undo after commitment cannot restore the previous redo stack. Retire the session
    // if a late failure followed a write, so the refused move cannot be replayed.
    return refused(session.packageRevision() === revision && session.part() === part ? failure : 'engine-failed');
  } catch { return refused('engine-failed'); }
}
