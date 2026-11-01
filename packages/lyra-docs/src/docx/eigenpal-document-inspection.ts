import type { DocxEditorInstance, EditorCommand } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
import type { DocxDocumentCapability, DocxDocumentCapabilityCode, DocxDocumentDiagnosticRule, DocxFragmentBlockKind } from './document-inspection-types.js';
import { DOCX_FRAGMENT_LIMITS } from './document-operations.js';
import type { DocxResult } from './types.js';
import { OOXML_TREE_LIMITS, WORD_NS as W, WORD_DRAWING_NS as WP, DRAWING_MAIN_NS as A, DRAWING_PICTURE_NS as PIC } from './ooxml.js';

export interface DocxEngineOutlineReport {
  readonly items: readonly Readonly<{ token: object; level: number; text: string; textTruncated: boolean }>[];
  readonly truncated: boolean;
}
export interface DocxEngineInspectionReport {
  readonly scope: 'body';
  readonly diagnostics: readonly Readonly<{ rule: DocxDocumentDiagnosticRule; data: Readonly<Record<string, string | number>>; token: object | null }>[];
  readonly capabilities: readonly DocxDocumentCapability[];
  readonly truncated: boolean;
}
export interface DocxEngineFragmentBlock {
  readonly token: object | null; readonly index: number; readonly kind: DocxFragmentBlockKind; readonly styleId: string | null;
  readonly headingLevel: number | null; readonly text: string; readonly textTruncated: boolean;
}
export interface DocxEngineFragmentReport {
  readonly start: number; readonly blockCount: number; readonly next: number | null; readonly truncated: boolean;
  readonly blocks: readonly DocxEngineFragmentBlock[];
}
/** Start at an index, or at the paragraph a current inspection token addresses. */
export interface DocxEngineFragmentRequest {
  readonly start?: number; readonly token?: object; readonly maxBlocks: number; readonly maxText: number;
}
const LIMITS: Readonly<{ parts: number; nodes: number; depth: number; attributes: number; text: number; items: number; diagnostics: number; label: number; cells: number }> = Object.freeze({ ...OOXML_TREE_LIMITS, text: 1_000_000, items: 512, diagnostics: 256, label: 256, cells: 4_000 });
const refusal = (code: 'unsupported' | 'resource-limit' | 'stale-selection' | 'invalid-option'): DocxResult<never> => ({ ok: false, code });
class InspectionFailure extends Error {
  constructor(readonly code: 'unsupported' | 'resource-limit') { super(code); }
}
function reject(code: 'unsupported' | 'resource-limit' = 'unsupported'): never { throw new InspectionFailure(code); }
function data(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return reject();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) return reject();
  return descriptor.value;
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value)) return reject();
  if (value.length > maximum) return reject('resource-limit');
  const copy: unknown[] = [];
  for (let i = 0; i < value.length; i++) copy.push(data(value, String(i)));
  return copy;
}
interface NodeCopy {
  id: string; name: string; ns: string; value: string | null; attributes: Map<string, string>; children: OoxmlNode[];
}
interface Frame { node: NodeCopy; path: NodeCopy[] }
const is = (node: NodeCopy, name: string, ns = W) => node.ns === ns && node.name === name;
const attr = (node: NodeCopy, name: string, ns = W) => node.attributes.get(`${ns}|${name}`);
function child(node: NodeCopy, name: string, nodes: Map<string, NodeCopy>, ns = W): NodeCopy | null {
  const found = node.children.map(value => nodes.get(String(data(value, 'id')))!).filter(value => is(value, name, ns));
  return found.length === 1 ? found[0]! : found.length ? reject() : null;
}
function readTree(root: OoxmlElement, limits: typeof LIMITS, budget: { nodes: number; text: number }, nodes: Map<string, NodeCopy>): Frame[] {
  const stack: { node: OoxmlNode; path: NodeCopy[] }[] = [{ node: root, path: [] }], frames: Frame[] = [], visited = new Set<object>();
  while (stack.length) {
    const frame = stack.pop()!, source = frame.node;
    if (++budget.nodes > limits.nodes || frame.path.length >= limits.depth) reject('resource-limit');
    if (visited.has(source)) reject();
    visited.add(source);
    const id = data(source, 'id'), kind = data(source, 'kind');
    if (typeof id !== 'string' || !id || id.length > 256 || nodes.has(id)) reject();
    let node: NodeCopy;
    if (kind === 'textValue') {
      const value = data(source, 'value');
      if (typeof value !== 'string') reject();
      budget.text += value.length; if (budget.text > limits.text) reject('resource-limit');
      node = { id, name: '', ns: '', value, attributes: new Map(), children: [] };
    } else {
      const name = data(source, 'localName'), ns = data(source, 'namespaceUri');
      if (typeof name !== 'string' || typeof ns !== 'string' || name.length > 256 || ns.length > 1024) reject();
      const attributes = new Map<string, string>();
      for (const a of array(data(source, 'attributes'), limits.attributes)) {
        const name = data(a, 'localName'), ns = data(a, 'namespaceUri'), value = data(a, 'value');
        if (typeof name !== 'string' || typeof ns !== 'string' || typeof value !== 'string' || name.length > 256 || ns.length > 1024) reject();
        budget.text += value.length; if (budget.text > limits.text) reject('resource-limit');
        const key = `${ns}|${name}`; if (attributes.has(key)) reject(); attributes.set(key, value);
      }
      const children = array(data(source, 'children'), limits.nodes - budget.nodes - stack.length) as OoxmlNode[];
      node = { id, name, ns, value: null, attributes, children };
      for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i]!, path: [...frame.path, node] });
    }
    nodes.set(id, node); frames.push({ node, path: frame.path });
  }
  return frames;
}
function clipped(text: string, maximum: number): { text: string; textTruncated: boolean } {
  let length = Math.min(text.length, maximum);
  if (length < text.length && length > 0 && /[\uD800-\uDBFF]/.test(text[length - 1]!)) length--;
  return { text: text.slice(0, length), textTruncated: length < text.length };
}
const families: readonly DocxDocumentCapabilityCode[] = ['body-headings', 'inline-image-descriptions', 'simple-table-headers'];
const hiddenNames = new Set(['vanish', 'webHidden', 'specVanish']);
const complexNames = new Set(['ins', 'del', 'moveFrom', 'moveTo', 'sdt', 'fldSimple', 'fldChar', 'instrText', 'pPrChange', 'rPrChange']);

const fragmentLimits = DOCX_FRAGMENT_LIMITS;
const elementName = (node: unknown): string | null => data(node, 'kind') === 'textValue' ? null :
  `${String(data(node, 'namespaceUri'))}|${String(data(node, 'localName'))}`;
const wordName = (name: string) => `${W}|${name}`;
function wordChild(node: unknown, name: string): unknown {
  return array(data(node, 'children'), LIMITS.nodes).find(value => elementName(value) === wordName(name)) ?? null;
}
function wordValue(node: unknown): string | null {
  for (const a of array(data(node, 'attributes'), LIMITS.attributes)) {
    if (data(a, 'namespaceUri') === W && data(a, 'localName') === 'val') {
      const value = data(a, 'value');
      return typeof value === 'string' ? value : null;
    }
  }
  return null;
}
const outlineLevel = (value: string | null): number | null => value && /^[0-8]$/.test(value) ? Number(value) + 1 : null;
interface FragmentBudget { nodes: number; text: number }
type TextFrame = { node: unknown; inText: boolean; inCell: boolean } | { exit: 'p' | 'tc' | 'tr'; inCell: boolean };
/** Plain text of one block, visiting only its own subtree within the shared node budget. */
function blockText(block: unknown, budget: FragmentBudget): { text: string; textTruncated: boolean; exhausted: boolean } {
  const cap = Math.min(fragmentLimits.blockText, budget.text);
  const stack: TextFrame[] = [{ node: block, inText: false, inCell: false }];
  let text = '', pending = '', trailing = 0, truncated = false, exhausted = false;
  const append = (value: string) => { if (!value) return; if (text) text += pending; pending = ''; trailing = 0; text += value; };
  while (stack.length) {
    if (text.length > cap) { truncated = true; break; }
    const frame = stack.pop()!;
    if ('exit' in frame) {
      if (frame.exit === 'p') { if (text) pending = frame.inCell ? ' ' : '\n'; }
      else if (frame.exit === 'tc') { pending = ''; text += '\t'; trailing = 1; }
      else { pending = ''; if (trailing) text = `${text.slice(0, -1)}\n`; else { text += '\n'; trailing = 1; } }
      continue;
    }
    if (--budget.nodes < 0) { budget.nodes = 0; truncated = exhausted = true; break; }
    const name = elementName(frame.node);
    if (name === null) {
      const value = data(frame.node, 'value');
      if (frame.inText && typeof value === 'string') append(value);
      continue;
    }
    if (name === wordName('tab')) append('\t');
    else if (name === wordName('br') || name === wordName('cr')) append('\n');
    const inCell = frame.inCell || name === wordName('tc');
    if (name === wordName('p') || name === wordName('tc') || name === wordName('tr')) {
      stack.push({ exit: name === wordName('p') ? 'p' : name === wordName('tc') ? 'tc' : 'tr', inCell: frame.inCell });
    }
    const children = array(data(frame.node, 'children'), LIMITS.nodes);
    for (let i = children.length - 1; i >= 0; i--) stack.push({ node: children[i], inText: name === wordName('t'), inCell });
  }
  if (trailing) text = text.slice(0, -trailing);
  const copy = clipped(text, cap);
  // A block clipped by the fragment's remaining budget, rather than the per-block cap, ends the slice.
  budget.text = truncated && cap < fragmentLimits.blockText ? 0 : budget.text - copy.text.length;
  return { text: copy.text, textTruncated: truncated || copy.textTruncated, exhausted };
}

/** Original bounded canonical metadata queries. No save, fetch, layout getter or native-input settlement. */
export function createDocumentInspection(current: () => DocxEditorInstance,
  navigate: (run: () => DocxResult<void>) => DocxResult<void>, overrides: Partial<typeof LIMITS> = {}) {
  const limits = { ...LIMITS, ...overrides };
  let tokens = new WeakMap<object, { paragraphId: string; valid(): boolean }>(), disposed = false;
  function query() {
    if (disposed) reject();
    for (const value of Object.values(limits)) if (!Number.isSafeInteger(value) || value < 0) reject();
    const editor = current(), surface = editor.surface;
    if (!surface) reject();
    const session = surface.session, generation = editor.mountGeneration, revision = session.packageRevision();
    const valid = () => !disposed && current() === editor && editor.surface === surface && editor.mountGeneration === generation &&
      surface.session === session && session.packageRevision() === revision;
    const pkg = session.currentPackage(), part = session.part();
    if (!valid()) throw new InspectionFailure('unsupported');
    if (pkg.parts.size > limits.parts) reject('resource-limit');
    if (pkg.parts.get(pkg.mainDocumentPart) !== part) reject();
    const nodes = new Map<string, NodeCopy>(), budget = { nodes: 0, text: 0 };
    const frames = readTree(part.root, limits, budget, nodes), root = frames[0]!.node;
    if (!is(root, 'document')) reject();
    const body = child(root, 'body', nodes); if (!body) reject();
    const styles = new Map<string, NodeCopy>(), styleNodes = new Map<string, NodeCopy>();
    for (const candidate of pkg.parts.values()) {
      if (candidate.name !== '/word/styles.xml' && !candidate.contentType?.endsWith('.styles+xml')) continue;
      if (styles.size || styleNodes.size) reject();
      const styleFrames = readTree(candidate.root, limits, budget, styleNodes), styleRoot = styleFrames[0]!.node;
      if (!is(styleRoot, 'styles')) reject();
      for (const frame of styleFrames) if (is(frame.node, 'style') && attr(frame.node, 'type') === 'paragraph') {
        const id = attr(frame.node, 'styleId'); if (!id || styles.has(id)) reject(); styles.set(id, frame.node);
      }
    }
    const descendants = new Map<string, Frame[]>();
    for (const frame of frames) for (const ancestor of frame.path) {
      if (!is(ancestor, 'p') && !is(ancestor, 'drawing') && !is(ancestor, 'tbl')) continue;
      const list = descendants.get(ancestor.id) ?? []; list.push(frame); descendants.set(ancestor.id, list);
    }
    const counts = new Map(families.map(code => [code, 0])), refused = new Set<DocxDocumentCapabilityCode>();
    const headings: { paragraph: NodeCopy; level: number; text: string; textTruncated: boolean }[] = [];
    let previousLevel: number | null = 0;
    const findings: { rule: DocxDocumentDiagnosticRule; data: Readonly<Record<string, string | number>>; paragraph: NodeCopy | null }[] = [];
    const limitation = (family: DocxDocumentCapabilityCode) => { if (family === 'body-headings') previousLevel = null; if (!refused.has(family)) findings.push({ rule: 'unsupported-content', data: Object.freeze({ family }), paragraph: null }); refused.add(family); };
    function headingLevel(paragraph: NodeCopy): number | null {
      const pr = child(paragraph, 'pPr', nodes); if (!pr) return null;
      const direct = child(pr, 'outlineLvl', nodes);
      if (direct) { const level = attr(direct, 'val'); if (!level || !/^[0-9]$/.test(level)) { limitation('body-headings'); return null; } return level === '9' ? null : Number(level) + 1; }
      const style = child(pr, 'pStyle', nodes); if (!style) return null;
      let id = attr(style, 'val'), depth = 0; const seen = new Set<string>();
      while (id) {
        if (seen.has(id) || ++depth > limits.depth) { limitation('body-headings'); return null; } seen.add(id);
        const definition = styles.get(id); if (!definition) { limitation('body-headings'); return null; }
        const name = child(definition, 'name', styleNodes), match = name && /^heading\s+([1-9])$/i.exec(attr(name, 'val') ?? '');
        const properties = child(definition, 'pPr', styleNodes), levelNode = properties && child(properties, 'outlineLvl', styleNodes);
        if (levelNode) { const level = attr(levelNode, 'val'); if (!level || !/^[0-9]$/.test(level)) { limitation('body-headings'); return null; } return level === '9' ? null : Number(level) + 1; }
        if (match) return Number(match[1]);
        const base = child(definition, 'basedOn', styleNodes); id = base ? attr(base, 'val') : undefined;
      }
      return null;
    }
    const hiddenStyles = [...styleNodes.values()].some(node => node.ns === W && hiddenNames.has(node.name) && !['0', 'false', 'off'].includes(attr(node, 'val') ?? ''));
    for (const frame of frames) {
      const node = frame.node;
      if (is(node, 'p') && frame.path.length === 2 && frame.path[1]?.id === body.id) {
        const level = headingLevel(node); if (level === null) continue;
        const content = descendants.get(node.id) ?? [];
        if (hiddenStyles || content.some(({ node }) => node.ns === W && (complexNames.has(node.name) || hiddenNames.has(node.name)))) { limitation('body-headings'); continue; }
        let text = '';
        for (const entry of content) if (entry.node.value !== null && is(entry.path.at(-1)!, 't')) text += entry.node.value;
        else if (is(entry.node, 'tab') || is(entry.node, 'br')) text += ' ';
        headings.push({ paragraph: node, level, ...clipped(text.replace(/[\u0000-\u001f]/g, ' '), limits.label) });
        counts.set('body-headings', counts.get('body-headings')! + 1);
        if (previousLevel !== null && level > previousLevel + 1) findings.push({ rule: 'heading-level-skipped', data: Object.freeze({ previousLevel, level }), paragraph: node });
        previousLevel = level;
      }
      if (is(node, 'drawing') && frame.path[1]?.id === body.id) {
        const inline = child(node, 'inline', nodes, WP);
        const properties = inline && child(inline, 'docPr', nodes, WP);
        const graphic = inline && child(inline, 'graphic', nodes, A), graphicData = graphic && child(graphic, 'graphicData', nodes, A);
        const picture = graphicData && child(graphicData, 'pic', nodes, PIC);
        const paragraph = [...frame.path].reverse().find(value => is(value, 'p')) ?? null;
        if (!inline || !properties || !picture || !graphicData || attr(graphicData, 'uri', '') !== PIC || !paragraph ||
          frame.path.some(value => value.ns === W && complexNames.has(value.name)) ||
          [...(descendants.get(paragraph.id) ?? [])].some(entry => entry.node.ns === W && hiddenNames.has(entry.node.name)) ||
          hiddenStyles || !['0', 'false', 'off'].includes(attr(properties, 'hidden', '') ?? '0')) { limitation('inline-image-descriptions'); continue; }
        counts.set('inline-image-descriptions', counts.get('inline-image-descriptions')! + 1);
        if (!(attr(properties, 'descr', '') ?? '').trim()) findings.push({ rule: 'image-description-missing', data: Object.freeze({}), paragraph });
      }
      if (is(node, 'tbl') && frame.path[1]?.id === body.id) {
        const content = descendants.get(node.id) ?? [], direct = frame.path.length === 2;
        const rows = node.children.map(value => nodes.get(String(data(value, 'id')))!).filter(value => is(value, 'tr'));
        const sizes = rows.map(row => row.children.map(value => nodes.get(String(data(value, 'id')))!).filter(value => is(value, 'tc')).length);
        const cells = content.filter(entry => is(entry.node, 'tc'));
        const forbidden = new Set([...complexNames, 'gridSpan', 'vMerge', 'hMerge', 'gridBefore', 'gridAfter', 'tblPrChange', 'trPrChange', 'tcPrChange']);
        const structural = content.some(entry => entry.node.ns === W && forbidden.has(entry.node.name) || is(entry.node, 'tbl'));
        const grid = child(node, 'tblGrid', nodes), columns = grid?.children.length;
        if (!direct || structural || cells.length > limits.cells || !rows.length || !sizes[0] || sizes.some(size => size !== sizes[0]) ||
          columns !== undefined && columns !== sizes[0] ||
          node.children.some(value => { const copy = nodes.get(String(data(value, 'id')))!; return !['tblPr', 'tblGrid', 'tr'].some(name => is(copy, name)); }) ||
          rows.some(row => row.children.some(value => { const copy = nodes.get(String(data(value, 'id')))!; return !['trPr', 'tc'].some(name => is(copy, name)); })) ||
          cells.some(entry => !entry.node.children.some(value => is(nodes.get(String(data(value, 'id')))!, 'p')) ||
            entry.node.children.some(value => { const copy = nodes.get(String(data(value, 'id')))!; return !['tcPr', 'p'].some(name => is(copy, name)); }))) { limitation('simple-table-headers'); continue; }
        counts.set('simple-table-headers', counts.get('simple-table-headers')! + 1);
        const properties = child(rows[0]!, 'trPr', nodes), header = properties && child(properties, 'tblHeader', nodes);
        if (!header || ['0', 'false', 'off'].includes(attr(header, 'val') ?? '')) {
          const paragraph = content.find(entry => is(entry.node, 'p'))?.node ?? null;
          findings.push({ rule: 'table-header-missing', data: Object.freeze({}), paragraph });
        }
      }
    }
    if (!valid()) throw new InspectionFailure('unsupported');
    const token = (paragraph: NodeCopy) => { const token = Object.freeze({}); tokens.set(token, { paragraphId: paragraph.id, valid }); return token; };
    return { headings, findings, token, capabilities: Object.freeze(families.map(code => Object.freeze({ code, count: counts.get(code)!,
      preserved: 'unverified' as const, renderable: 'unverified' as const, editable: 'unverified' as const, refused: refused.has(code) }))) };
  }
  function failure(error: unknown) { return refusal(error instanceof InspectionFailure ? error.code : 'unsupported'); }
  /** Lazily reads paragraph style definitions once per fragment; ambiguity yields no level rather than a guess. */
  function styleLevels(pkg: ReturnType<NonNullable<DocxEditorInstance['surface']>['session']['currentPackage']>) {
    let definitions: { styles: Map<string, NodeCopy>; nodes: Map<string, NodeCopy> } | null | undefined;
    const load = () => {
      if (definitions !== undefined) return definitions;
      try {
        const nodes = new Map<string, NodeCopy>(), styles = new Map<string, NodeCopy>(), budget = { nodes: 0, text: 0 };
        for (const candidate of pkg.parts.values()) {
          if (candidate.name !== '/word/styles.xml' && !candidate.contentType?.endsWith('.styles+xml')) continue;
          if (styles.size) reject();
          const frames = readTree(candidate.root, limits, budget, nodes);
          if (!is(frames[0]!.node, 'styles')) reject();
          for (const frame of frames) if (is(frame.node, 'style') && attr(frame.node, 'type') === 'paragraph') {
            const id = attr(frame.node, 'styleId'); if (!id || styles.has(id)) reject(); styles.set(id, frame.node);
          }
        }
        definitions = { styles, nodes };
      } catch { definitions = null; }
      return definitions;
    };
    return (first: string): number | null => {
      try {
        const loaded = load(); if (!loaded) return null;
        const seen = new Set<string>();
        for (let id: string | undefined = first; id;) {
          if (seen.has(id) || seen.size >= limits.depth) return null;
          seen.add(id);
          const definition = loaded.styles.get(id); if (!definition) return null;
          const properties = child(definition, 'pPr', loaded.nodes), level = properties && child(properties, 'outlineLvl', loaded.nodes);
          if (level) return outlineLevel(attr(level, 'val') ?? null);
          const name = child(definition, 'name', loaded.nodes), match = name && /^heading\s+([1-9])$/i.exec(attr(name, 'val') ?? '');
          if (match) return Number(match[1]);
          const base = child(definition, 'basedOn', loaded.nodes); id = base ? attr(base, 'val') : undefined;
        }
        return null;
      } catch { return null; }
    };
  }
  return {
    /** Copies a bounded run of top-level body blocks; other blocks' subtrees are never visited. */
    fragment(request: DocxEngineFragmentRequest): DocxResult<DocxEngineFragmentReport> {
      try {
        if (disposed) reject();
        const editor = current(), surface = editor.surface;
        if (!surface) reject();
        const session = surface.session, generation = editor.mountGeneration, revision = session.packageRevision();
        const valid = () => !disposed && current() === editor && editor.surface === surface && editor.mountGeneration === generation &&
          surface.session === session && session.packageRevision() === revision;
        const pkg = session.currentPackage(), part = session.part();
        if (!valid() || pkg.parts.get(pkg.mainDocumentPart) !== part) reject();
        if (elementName(part.root) !== wordName('document')) reject();
        const bodies = array(data(part.root, 'children'), limits.nodes).filter(value => elementName(value) === wordName('body'));
        if (bodies.length !== 1) reject();
        const blocks = array(data(bodies[0], 'children'), fragmentLimits.bodyBlocks).filter(value => elementName(value) !== null);
        let start = request.start ?? 0;
        if (request.token !== undefined) {
          const target = tokens.get(request.token);
          if (!target || !target.valid()) return refusal('stale-selection');
          start = blocks.findIndex(block => data(block, 'id') === target.paragraphId);
          if (start < 0) return refusal('stale-selection');
        }
        if (start > blocks.length) return refusal('invalid-option');
        const level = styleLevels(pkg), budget: FragmentBudget = { nodes: fragmentLimits.nodes, text: request.maxText };
        const read: (Omit<DocxEngineFragmentBlock, 'token'> & { id: string | null })[] = [];
        let index = start, truncated = false;
        while (index < blocks.length && read.length < request.maxBlocks && budget.text > 0 && budget.nodes > 0) {
          const block = blocks[index]!, name = elementName(block);
          const kind: DocxFragmentBlockKind = name === wordName('p') ? 'paragraph' : name === wordName('tbl') ? 'table' : 'other';
          let styleId: string | null = null, headingLevel: number | null = null;
          if (kind === 'paragraph') {
            const properties = wordChild(block, 'pPr');
            const style = properties && wordChild(properties, 'pStyle'), direct = properties && wordChild(properties, 'outlineLvl');
            const id = style ? wordValue(style) : null;
            styleId = id && id.length <= 128 ? id : null;
            headingLevel = direct ? outlineLevel(wordValue(direct)) : styleId ? level(styleId) : null;
          }
          const content = blockText(block, budget);
          truncated ||= content.textTruncated;
          const id = data(block, 'id');
          read.push({ id: kind === 'paragraph' && typeof id === 'string' && id ? id : null, index, kind, styleId, headingLevel,
            text: content.text, textTruncated: content.textTruncated });
          index++;
          if (content.exhausted) break;
        }
        if (!valid()) throw new InspectionFailure('unsupported');
        const token = (paragraphId: string) => { const value = Object.freeze({}); tokens.set(value, { paragraphId, valid }); return value; };
        return { ok: true, value: Object.freeze({ start, blockCount: blocks.length, next: index < blocks.length ? index : null, truncated,
          blocks: Object.freeze(read.map(({ id, ...value }) => Object.freeze({ ...value, token: id ? token(id) : null }))) }) };
      } catch (error) { return failure(error); }
    },
    /** The paragraph a current token addresses, or null once any edit or navigation target change invalidated it. */
    resolve(token: object): string | null {
      const target = tokens.get(token);
      return target && target.valid() ? target.paragraphId : null;
    },
    outline(): DocxResult<DocxEngineOutlineReport> {
      try { const report = query(); return { ok: true, value: Object.freeze({ items: Object.freeze(report.headings.slice(0, limits.items).map(({ paragraph, ...value }) =>
        Object.freeze({ ...value, token: report.token(paragraph) }))), truncated: report.headings.length > limits.items }) }; }
      catch (error) { return failure(error); }
    },
    inspectDocument(): DocxResult<DocxEngineInspectionReport> {
      try { const report = query(); return { ok: true, value: Object.freeze({ scope: 'body' as const,
        diagnostics: Object.freeze(report.findings.slice(0, limits.diagnostics).map(({ paragraph, ...value }) => Object.freeze({ ...value, token: paragraph ? report.token(paragraph) : null }))),
        capabilities: report.capabilities, truncated: report.findings.length > limits.diagnostics }) }; }
      catch (error) { return failure(error); }
    },
    select(token: object): DocxResult<void> {
      return navigate(() => {
        try {
          const target = tokens.get(token); if (!target || !target.valid()) return refusal('stale-selection');
          const editor = current(), position = { paragraphId: target.paragraphId, offset: 0 };
          const command: EditorCommand = { type: 'setSelection', range: { anchor: position, head: { ...position } } };
          const allowed = editor.can(command); if (!target.valid()) return refusal('stale-selection');
          if (!allowed.ok) return refusal('unsupported');
          const result = editor.exec(command); if (!target.valid()) return refusal('stale-selection');
          return result.ok ? { ok: true, value: undefined } : refusal('unsupported');
        } catch (error) { return failure(error); }
      });
    },
    invalidate() { tokens = new WeakMap(); },
    dispose() { disposed = true; tokens = new WeakMap(); },
  };
}
