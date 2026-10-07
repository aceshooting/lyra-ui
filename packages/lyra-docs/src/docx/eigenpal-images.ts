import type { DocxEditorInstance, EditorCommand } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode, OoxmlPackage, OoxmlPart } from '@docx-editor.dev/core/store';
import { DOCX_LIMITS } from './commands.js';
import { inspectDocxImage } from './image-bytes.js';
import { OFFICE_REL_NS as R, resolveOoxmlPart, WORD_NS as W } from './ooxml.js';
import { isDocxXmlText } from './xml-text.js';
import type { DocxImageAction, DocxImageContext, DocxImageDescription, DocxResult } from './types.js';

const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const WP14 = 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing';
const LIMITS = { parts: 128, nodes: 20_000, depth: 64, attributes: 64, drawing: 512 };
const refused = (code: 'unsupported' | 'resource-limit' | 'stale-selection' | 'no-selection'): DocxResult<never> => ({ ok: false, code });
type SelectedImage = NonNullable<ReturnType<DocxEditorInstance['getSelectedImage']>>;
export interface ImageCopy {
  readonly id: string;
  readonly context: Readonly<DocxImageContext>;
  readonly description: DocxResult<Readonly<DocxImageDescription>>;
  readonly supported: boolean;
}

/** Copy bounded scalars only, after the adapter has settled native input. */
export function copyImage(image: SelectedImage | null | undefined): ImageCopy | null {
  if (!image || !Number.isSafeInteger(image.widthEmu) || image.widthEmu <= 0 ||
    !Number.isSafeInteger(image.heightEmu) || image.heightEmu <= 0) return null;
  const readable = image.kind === 'inline' && image.wrap === 'inline' && !image.hidden && ['ready', 'pending'].includes(image.resourceStatus) &&
    image.position === null && image.hyperlink === null && image.rotationDegrees === 0 &&
    Object.values(image.crop).every(value => value === 0) &&
    Object.entries(image.locks).every(([name, value]) => value === false || name === 'changeAspect');
  const supported = readable && image.resourceStatus === 'ready';
  const description = !readable ? refused('unsupported') : boundedDescription(image.title, image.description);
  return Object.freeze({ id: image.id, context: Object.freeze({ widthPoints: image.widthEmu / 12700,
    heightPoints: image.heightEmu / 12700 }), supported, description });
}
function boundedDescription(title: string, description: string): DocxResult<Readonly<DocxImageDescription>> {
  if (title.length > DOCX_LIMITS.imageTitle || description.length > DOCX_LIMITS.imageDescription) return refused('resource-limit');
  if (!isDocxXmlText(title) || !isDocxXmlText(description)) return refused('unsupported');
  return Object.freeze({ ok: true, value: Object.freeze({ title, description }) });
}
export interface ImageIntent {
  readonly id: string;
  readonly revision: number;
  readonly paragraphId: string;
  readonly offset: number;
  valid(): boolean;
}
/** Pure surface identities bind the original image before explicit input settlement. */
export function captureImageIntent(editor: DocxEditorInstance, image: ImageCopy | null): ImageIntent | null {
  const surface = editor.surface;
  if (!surface || !image) return null;
  const session = surface.session, generation = editor.mountGeneration, revision = session.packageRevision();
  const selection = surface.state().selection;
  const paragraphId = selection.anchor.paragraphId, offset = selection.anchor.offset;
  const valid = () => {
    if (editor.surface !== surface || editor.mountGeneration !== generation || surface.session !== session ||
      session.packageRevision() !== revision || surface.storyScope().kind !== 'body') return false;
    const state = surface.state(), drawing = surface.drawingSelectionIntent();
    return state.cellSelection === null && state.selection.anchor.paragraphId === paragraphId &&
      state.selection.head.paragraphId === paragraphId && state.selection.anchor.offset === offset &&
      state.selection.head.offset === offset && 'drawingNodeId' in drawing && drawing.drawingNodeId === image.id;
  };
  return { id: image.id, revision, paragraphId, offset, valid };
}
const element = (node: OoxmlNode): node is OoxmlElement => node.kind !== 'textValue';
const is = (node: OoxmlNode, ns: string, name: string): node is OoxmlElement => element(node) && node.namespaceUri === ns && node.localName === name;
const attribute = (node: OoxmlElement, name: string, ns = '') => node.attributes.find(value => value.localName === name && value.namespaceUri === ns)?.value;
interface Frame { node: OoxmlNode; path: OoxmlElement[] }
class QualificationFailure extends Error {
  constructor(readonly code: 'unsupported' | 'resource-limit') { super(code); }
}
function reject(code: 'unsupported' | 'resource-limit' = 'unsupported'): never { throw new QualificationFailure(code); }
function walk(root: OoxmlElement, limits: typeof LIMITS): Frame[] {
  const frames: Frame[] = [], stack: Frame[] = [{ node: root, path: [] }], ids = new Set<string>();
  while (stack.length) {
    const frame = stack.pop()!, node = frame.node;
    if (frames.length >= limits.nodes || frame.path.length >= limits.depth) reject('resource-limit');
    if (ids.has(node.id)) reject();
    ids.add(node.id); frames.push(frame);
    if (!element(node)) continue;
    if (node.attributes.length > limits.attributes || node.children.length + stack.length > limits.nodes - frames.length) reject('resource-limit');
    const attrs = new Set<string>();
    for (const a of node.attributes) {
      const key = `${a.namespaceUri}:${a.localName}`;
      if (attrs.has(key)) reject();
      attrs.add(key);
    }
    for (let index = node.children.length - 1; index >= 0; index--) stack.push({ node: node.children[index]!, path: [...frame.path, node] });
  }
  return frames;
}
function child(parent: OoxmlElement, ns: string, name: string): OoxmlElement {
  const matches = parent.children.filter(node => is(node, ns, name));
  if (matches.length !== 1) reject();
  return matches[0] as OoxmlElement;
}
function positive(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) reject();
  return Number(value);
}
function internalTarget(owner: string, value: string): string {
  return resolveOoxmlPart(owner, value) ?? reject();
}
/** Conservative visibility proof: styled targets and packages with hidden style rules are refused. */
function visibleProperties(path: readonly OoxmlElement[], limits: typeof LIMITS): void {
  for (const owner of path.slice(-2)) for (const property of owner.children) {
    if (!is(property, W, owner.localName === 'p' ? 'pPr' : 'rPr')) continue;
    for (const { node } of walk(property, limits)) {
      // Named styles are safe here: visibleStyles() already refuses packages whose styles can hide content.
      if (element(node) && node.namespaceUri === W && ['vanish', 'webHidden', 'specVanish'].includes(node.localName)) reject();
    }
  }
}
function visibleStyles(pkg: OoxmlPackage, limits: typeof LIMITS): void {
  for (const part of pkg.parts.values()) {
    if (!part.contentType.endsWith('.styles+xml')) continue;
    for (const { node } of walk(part.root, limits)) {
      if (is(node, W, 'vanish') || is(node, W, 'webHidden') || is(node, W, 'specVanish')) reject();
    }
  }
}
const permitted: Record<string, readonly string[]> = {
  [`${W}|drawing`]: [`${WP}|inline`],
  [`${WP}|inline`]: [`${WP}|extent`, `${WP}|effectExtent`, `${WP}|docPr`, `${WP}|cNvGraphicFramePr`, `${A}|graphic`],
  [`${WP}|extent`]: [], [`${WP}|effectExtent`]: [], [`${WP}|docPr`]: [`${A}|extLst`],
  [`${WP}|cNvGraphicFramePr`]: [`${A}|graphicFrameLocks`],
  [`${A}|graphicFrameLocks`]: [], [`${A}|graphic`]: [`${A}|graphicData`],
  [`${A}|graphicData`]: [`${PIC}|pic`],
  [`${PIC}|pic`]: [`${PIC}|nvPicPr`, `${PIC}|blipFill`, `${PIC}|spPr`],
  [`${PIC}|nvPicPr`]: [`${PIC}|cNvPr`, `${PIC}|cNvPicPr`],
  [`${PIC}|cNvPr`]: [`${A}|extLst`], [`${PIC}|cNvPicPr`]: [`${A}|picLocks`], [`${A}|picLocks`]: [],
  [`${PIC}|blipFill`]: [`${A}|blip`, `${A}|srcRect`, `${A}|stretch`], [`${A}|blip`]: [`${A}|extLst`], [`${A}|srcRect`]: [],
  [`${A}|stretch`]: [`${A}|fillRect`], [`${A}|fillRect`]: [],
  [`${PIC}|spPr`]: [`${A}|xfrm`, `${A}|prstGeom`, `${A}|noFill`, `${A}|ln`],
  [`${A}|noFill`]: [], [`${A}|ln`]: [`${A}|noFill`, `${A}|miter`, `${A}|round`, `${A}|bevel`, `${A}|headEnd`, `${A}|tailEnd`],
  [`${A}|miter`]: [], [`${A}|round`]: [], [`${A}|bevel`]: [], [`${A}|headEnd`]: [], [`${A}|tailEnd`]: [],
  [`${A}|xfrm`]: [`${A}|off`, `${A}|ext`], [`${A}|off`]: [], [`${A}|ext`]: [],
  [`${A}|prstGeom`]: [`${A}|avLst`], [`${A}|avLst`]: [],
};
const lockNames = ['noGrp', 'noSelect', 'noRot', 'noChangeAspect', 'noMove', 'noResize', 'noEditPoints', 'noAdjustHandles', 'noChangeArrowheads', 'noChangeShapeType', 'noCrop', 'noDrilldown'];
const attributeNames: Record<string, readonly string[]> = {
  inline: ['distT', 'distB', 'distL', 'distR', 'anchorId', 'editId'], extent: ['cx', 'cy'], effectExtent: ['l', 't', 'r', 'b'],
  docPr: ['id', 'name', 'title', 'descr', 'hidden'], graphicData: ['uri'], cNvPr: ['id', 'name', 'title', 'descr', 'hidden'],
  cNvPicPr: ['preferRelativeResize'], blip: ['embed', 'cstate'], blipFill: ['dpi', 'rotWithShape'], spPr: ['bwMode'],
  xfrm: ['rot', 'flipH', 'flipV'], ln: ['w', 'cap', 'cmpd', 'algn'], noFill: [], miter: ['lim'], round: [], bevel: [],
  headEnd: ['type', 'w', 'len'], tailEnd: ['type', 'w', 'len'],
  off: ['x', 'y'], ext: ['cx', 'cy'], prstGeom: ['prst'], picLocks: lockNames, graphicFrameLocks: lockNames,
};
const namespaces: Record<string, string> = { embed: R, anchorId: WP14, editId: WP14 };
const extensionList = (node: OoxmlNode): boolean => is(node, A, 'extLst');
/** Office extension lists are opaque, uniquely identified `a:ext` records that the engine preserves verbatim. */
function extensions(list: OoxmlElement): void {
  const uris = new Set<string>();
  for (const entry of list.children) {
    if (!is(entry, A, 'ext') || entry.attributes.length !== 1) reject();
    const uri = attribute(entry, 'uri');
    if (!uri || !/^\{[0-9A-Fa-f-]{36}\}$/.test(uri) || uris.has(uri)) reject();
    uris.add(uri);
  }
}
function plainDrawing(nodes: Frame[]): void {
  for (const { node, path } of nodes) {
    if (path.some(extensionList)) continue;
    if (!element(node)) reject();
    if (node.namespaceUri === A && node.localName === 'extLst') { extensions(node); continue; }
    const allowed = permitted[`${node.namespaceUri}|${node.localName}`];
    if (!allowed) reject();
    const seen = new Set<string>();
    for (const descendant of node.children) {
      if (!element(descendant)) reject();
      const key = `${descendant.namespaceUri}|${descendant.localName}`;
      if (!allowed.includes(key) || seen.has(key)) reject();
      seen.add(key);
    }
    for (const a of node.attributes) {
      if (!(attributeNames[node.localName] ?? []).includes(a.localName) ||
        a.namespaceUri !== ((node.localName === 'blip' || node.localName === 'inline') ? namespaces[a.localName] ?? '' : '')) reject();
      if (node.localName === 'inline' && a.namespaceUri === WP14 && !/^[0-9A-Fa-f]{8}$/.test(a.value)) reject();
      if (node.localName === 'inline' && a.namespaceUri === '' && a.value !== '0') reject();
      if (node.localName === 'effectExtent' && !/^\d{1,9}$/.test(a.value)) reject();
      if (a.localName === 'cstate' && !['print', 'screen', 'email', 'hqprint', 'none'].includes(a.value)) reject();
      if (a.localName === 'preferRelativeResize' && !['0', '1', 'false', 'true'].includes(a.value)) reject();
      if (a.localName === 'dpi' && a.value !== '0') reject();
      if (a.localName === 'rotWithShape' && !['0', '1', 'false', 'true'].includes(a.value)) reject();
      if (a.localName === 'bwMode' && a.value !== 'auto') reject();
      // Outline geometry of an unfilled picture border: bounded tokens only, never references.
      if (node.localName === 'ln' && a.localName === 'w' && !/^\d{1,8}$/.test(a.value)) reject();
      if (['cap', 'cmpd', 'algn', 'type', 'len', 'lim'].includes(a.localName) || (a.localName === 'w' && node.localName !== 'ln'))
        if (!/^[A-Za-z0-9]{1,16}$/.test(a.value)) reject();
      if (a.localName === 'hidden' && a.value !== '0' && a.value !== 'false') reject();
      if (a.localName === 'rot' && a.value !== '0') reject();
      if (['flipH', 'flipV'].includes(a.localName) && a.value !== '0' && a.value !== 'false') reject();
    }
    if (is(node, A, 'picLocks') || is(node, A, 'graphicFrameLocks')) {
      // Aspect and (picture-irrelevant) arrowhead locks only constrain shape editing; every other lock keeps the picture read-only.
      for (const a of node.attributes) if (a.namespaceUri !== '' || !lockNames.includes(a.localName) ||
        !(['0', 'false'].includes(a.value) || (['noChangeAspect', 'noChangeArrowheads'].includes(a.localName) && ['1', 'true'].includes(a.value)))) reject();
    }
    if (is(node, A, 'off') && (attribute(node, 'x') !== '0' || attribute(node, 'y') !== '0')) reject();
    if (is(node, A, 'prstGeom') && attribute(node, 'prst') !== 'rect') reject();
    if (is(node, A, 'fillRect') && node.attributes.length) reject();
  }
}

interface ImageDocument {
  pkg: OoxmlPackage;
  part: OoxmlPart;
  limits: typeof LIMITS;
  frames: Frame[];
  descendants: Map<OoxmlElement, Frame[]>;
}
function imageDocument(editor: DocxEditorInstance, overrides: Partial<typeof LIMITS>): ImageDocument {
  const surface = editor.surface;
  if (!surface) reject();
  return imageDocumentInPackage(surface.session.currentPackage(), surface.session.part(), overrides);
}
function imageDocumentInPackage(pkg: OoxmlPackage, part: OoxmlPart, overrides: Partial<typeof LIMITS>): ImageDocument {
  const limits = { ...LIMITS, ...overrides };
  if (pkg.parts.size > limits.parts) reject('resource-limit');
  if (pkg.parts.get(pkg.mainDocumentPart) !== part || !is(part.root, W, 'document')) reject();
  if (part.root.children.length > limits.nodes) reject('resource-limit');
  if (part.root.children.filter(node => is(node, W, 'body')).length !== 1) reject();
  const frames = walk(part.root, limits), descendants = new Map<OoxmlElement, Frame[]>();
  for (const frame of frames) {
    const drawing = is(frame.node, W, 'drawing') ? frame.node : frame.path.find(node => is(node, W, 'drawing'));
    if (!drawing) continue;
    const list = descendants.get(drawing) ?? []; list.push(frame); descendants.set(drawing, list);
  }
  visibleStyles(pkg, limits);
  return { pkg, part, limits, frames, descendants };
}
interface DrawingValue { drawingId: string; paragraphId: string; width: number; height: number; title: string; description: string }
function inspectDrawing(document: ImageDocument, target: Frame,
  mediaCache = new Map<string, { pixels: number; mimeType: string }>(), budget = { bytes: 0, maximum: Infinity }): DrawingValue {
  const { pkg, part, limits } = document, path = target.path;
  // Body paragraphs, optionally inside plain table cells: document/body/(tbl/tr/tc)*/p/r/drawing.
  if (!is(target.node, W, 'drawing') || path.length < 4 || (path.length - 4) % 3 !== 0 || !is(path[0]!, W, 'document') ||
    !is(path[1]!, W, 'body') || !is(path.at(-2)!, W, 'p') || !is(path.at(-1)!, W, 'r')) reject();
  for (let index = 2; index < path.length - 2; index += 3)
    if (!is(path[index]!, W, 'tbl') || !is(path[index + 1]!, W, 'tr') || !is(path[index + 2]!, W, 'tc')) reject();
  visibleProperties(path, limits);
  const descendants = document.descendants.get(target.node)!;
  if (descendants.length > limits.drawing) reject('resource-limit');
  plainDrawing(descendants);
  const inline = child(target.node, WP, 'inline'), outer = child(inline, WP, 'extent'), properties = child(inline, WP, 'docPr');
  const graphic = child(inline, A, 'graphic'), data = child(graphic, A, 'graphicData');
  if (attribute(data, 'uri') !== PIC) reject();
  const picture = child(data, PIC, 'pic');
  const nonVisual = child(picture, PIC, 'nvPicPr');
  child(nonVisual, PIC, 'cNvPr'); child(nonVisual, PIC, 'cNvPicPr');
  const shape = child(picture, PIC, 'spPr'), transform = child(shape, A, 'xfrm');
  child(transform, A, 'off'); child(child(shape, A, 'prstGeom'), A, 'avLst');
  const fill = child(picture, PIC, 'blipFill');
  child(child(fill, A, 'stretch'), A, 'fillRect');
  const inner = child(transform, A, 'ext');
  const width = positive(attribute(outer, 'cx')), height = positive(attribute(outer, 'cy'));
  positive(attribute(inner, 'cx')); positive(attribute(inner, 'cy'));
  const metadata = boundedDescription(attribute(properties, 'title') ?? '', attribute(properties, 'descr') ?? '');
  if (!metadata.ok) reject(metadata.code === 'resource-limit' ? 'resource-limit' : 'unsupported');
  const blip = child(fill, A, 'blip'), id = attribute(blip, 'embed', R);
  if (!id || blip.attributes.some(value => value.localName !== 'embed' && value.localName !== 'cstate')) reject();
  const relations = pkg.relationships.get(part.name) ?? [];
  if (relations.length > limits.nodes) reject('resource-limit');
  const matches = relations.filter(relation => relation.id === id);
  if (matches.length !== 1 || matches[0]!.type !== `${R}/image` || matches[0]!.targetMode === 'External') reject();
  const media = internalTarget(part.name, matches[0]!.rawTarget), bytes = pkg.partBytes.get(media);
  if (!bytes) reject();
  let checked = mediaCache.get(media);
  if (!checked) {
    budget.bytes += bytes.length;
    if (budget.bytes > budget.maximum) reject('resource-limit');
    const inspected = inspectDocxImage(bytes);
    if (!inspected.ok) reject(inspected.code === 'resource-limit' ? 'resource-limit' : 'unsupported');
    checked = inspected.value; mediaCache.set(media, checked);
  }
  const mime = pkg.contentTypes.overrides.get(media.toLowerCase()) ?? pkg.contentTypes.defaults.get(media.split('.').at(-1)!.toLowerCase());
  if (mime !== checked.mimeType) reject();
  return { drawingId: target.node.id, paragraphId: path.at(-2)!.id, width, height,
    title: metadata.value.title, description: metadata.value.description };
}

/** One bounded traversal and shared media inspection for explicit image navigation. */
export function imageCandidates(editor: DocxEditorInstance, overrides: Partial<typeof LIMITS> &
  { candidates?: number; attempts?: number; mediaBytes?: number } = {}): DocxResult<readonly DrawingValue[]> {
  try {
    const surface = editor.surface;
    if (!surface) reject();
    return imageCandidatesInPackage(surface.session.currentPackage(), surface.session.part(), overrides);
  } catch (error) { return refused(error instanceof QualificationFailure ? error.code : 'unsupported'); }
}

/** Bounded package inspection shared by navigation and isolated insertion preflight. */
export function imageCandidatesInPackage(pkg: OoxmlPackage, part: OoxmlPart, overrides: Partial<typeof LIMITS> &
  { candidates?: number; attempts?: number; mediaBytes?: number } = {}): DocxResult<readonly DrawingValue[]> {
  try {
    const document = imageDocumentInPackage(pkg, part, overrides), candidates = document.frames.filter(frame => is(frame.node, W, 'drawing'));
    if (candidates.length > (overrides.candidates ?? 256) || candidates.length > (overrides.attempts ?? 64)) reject('resource-limit');
    const mediaCache = new Map<string, { pixels: number; mimeType: string }>();
    const budget = { bytes: 0, maximum: overrides.mediaBytes ?? 16 * 1024 * 1024 }, values: DrawingValue[] = [];
    for (const candidate of candidates) {
      try { values.push(inspectDrawing(document, candidate, mediaCache, budget)); }
      catch (error) { if (!(error instanceof QualificationFailure) || error.code !== 'unsupported') throw error; }
    }
    return { ok: true, value: values };
  } catch (error) { return refused(error instanceof QualificationFailure ? error.code : 'unsupported'); }
}

/** Explicit operation only. No layout getters, cold indexes, serialization or mutations. */
export function qualifyImageCommand(editor: DocxEditorInstance, intent: ImageIntent, action: DocxImageAction,
  overrides: Partial<typeof LIMITS> = {}): DocxResult<{ command: EditorCommand; unchanged: boolean; valid(): boolean }> {
  try {
    if (!intent.valid()) return refused('stale-selection');
    const document = imageDocument(editor, overrides), target = document.frames.find(frame => frame.node.id === intent.id);
    if (!target) reject();
    const actual = inspectDrawing(document, target), { width, height } = actual;
    if (actual.paragraphId !== intent.paragraphId) reject();
    const common = { drawingNodeId: intent.id, expectedPackageRevision: intent.revision };
    let command: EditorCommand, unchanged = false;
    if (action.type === 'delete-image') command = { type: 'deleteImage', ...common };
    else {
      const values = action.type === 'resize-image' ? { widthEmu: Math.round(action.widthPoints * 12700), heightEmu: Math.round(action.heightPoints * 12700) } : { title: action.title, description: action.description };
      unchanged = 'widthEmu' in values ? values.widthEmu === width && values.heightEmu === height : values.title === actual.title && values.description === actual.description;
      command = { type: 'setImageProperties', ...common, selectionParagraphId: intent.paragraphId, selectionOffset: intent.offset, ...values };
    }
    return intent.valid() ? { ok: true, value: { command, unchanged, valid: intent.valid } } : refused('stale-selection');
  } catch (error) { return refused(error instanceof QualificationFailure ? error.code : 'unsupported'); }
}
