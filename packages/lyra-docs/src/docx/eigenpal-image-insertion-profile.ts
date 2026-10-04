import { SaxesParser } from 'saxes';
import type { OoxmlElement, OoxmlNode, OoxmlPackage, OoxmlPart } from '@docx-editor.dev/core/store';
import { imageCandidatesInPackage } from './eigenpal-images.js';
import { inspectDocxImage } from './image-bytes.js';
import { isDocxXmlText } from './xml-text.js';
import type { DocxRefusalCode, DocxResult } from './types.js';

export interface ImageInsertionProfileDependencies {
  readonly readOoxmlPart: typeof import('@docx-editor.dev/core/store').readOoxmlPart;
  readonly defaultStylesPart: OoxmlPart;
}
interface ImageInsertionBudget {
  readonly mediaBytes: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly titleLength: number;
  readonly descriptionLength: number;
}
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const XML = 'http://www.w3.org/XML/1998/namespace';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const MAIN = '/word/document.xml', STYLES = '/word/styles.xml', TYPES = '/[Content_Types].xml';
const ROOT_RELS = '/_rels/.rels', MAIN_RELS = '/word/_rels/document.xml.rels';
const MAIN_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const STYLES_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml';
const RELS_MIME = 'application/vnd.openxmlformats-package.relationships+xml';
const MAX_ZIP = 16 * 1024 * 1024;
const MAX_MEDIA = 4 * 1024 * 1024;
const NAMESPACES = new Set([W, W14, R, REL, CT, XML, WP, A, PIC]);
const XML_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
class ProfileRefusal extends Error {
  constructor(readonly code: DocxRefusalCode) { super(code); }
}
function requireProfile(value: unknown, code: DocxRefusalCode = 'unsupported'): asserts value {
  if (!value) throw new ProfileRefusal(code);
}
function bounded(value: number, minimum: number, maximum: number): void {
  requireProfile(Number.isSafeInteger(value) && value >= minimum && value <= maximum, 'resource-limit');
}
function add(left: number, right: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const result = left + right; bounded(result, 0, maximum); return result;
}
const element = (node: OoxmlNode): node is OoxmlElement => node.kind !== 'textValue';
const is = (node: OoxmlNode, ns: string, name: string): boolean => element(node) && node.namespaceUri === ns && node.localName === name;
const attribute = (node: OoxmlElement, name: string, ns = '') => node.attributes.find(a => a.namespaceUri === ns && a.localName === name)?.value;
const elements = (node: OoxmlElement): OoxmlElement[] => (node.children as readonly OoxmlNode[]).filter(element);
function whitespace(node: OoxmlElement): void {
  for (const child of node.children) if (!element(child)) requireProfile(/^[\t\n ]*$/.test(child.value));
}
function attributes(node: OoxmlElement, names: readonly string[], ns = ''): void {
  for (const attr of node.attributes) requireProfile(attr.namespaceUri === ns && names.includes(attr.localName));
}
function pathAllowed(path: string): boolean {
  return path.length <= 256 && /^\/[\x21-\x7e]+$/.test(path) && !/[\\%?#]/.test(path) &&
    path.slice(1).split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..');
}
function scalar(value: string, maximum = 1024): void {
  bounded(value.length, 0, maximum); requireProfile(isDocxXmlText(value) && !value.includes('\r'));
}
interface Census { nodes: number; bindings: number; ids: Set<string> }
interface Shape { bytes: number; nodes: number; drawings: OoxmlElement[]; embeds: Set<string>; docPrIds: number[] }
const newCensus = (): Census => ({ nodes: 0, bindings: 0, ids: new Set() });
const qnameBound = (ns: string, local: string) => (ns ? 81 : 0) + 3 * local.length;

/** Iterative bounds precede every tree helper, index and public XML reader. */
function scanPart(part: OoxmlPart, totals: Census, nodeLimit = 20000, depthLimit = 64): Shape {
  const stack: { node: OoxmlNode; depth: number }[] = [{ node: part.root, depth: 1 }];
  const uris = new Set<string>(), drawings: OoxmlElement[] = [], embeds = new Set<string>(), docPrIds: number[] = [];
  let bytes = 0, nodes = 0;
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    totals.nodes = add(totals.nodes, 1, 20000); nodes = add(nodes, 1, nodeLimit); bounded(depth, 1, depthLimit);
    requireProfile(typeof node.id === 'string' && !totals.ids.has(node.id)); totals.ids.add(node.id);
    if (!element(node)) {
      bytes = add(bytes, 6 * node.value.length, MAX_ZIP);
      requireProfile(isDocxXmlText(node.value) && !node.value.includes('\r')); continue;
    }
    bounded(node.attributes.length, 0, 64); bounded(node.namespaceBindings.length, 0, 16);
    bounded(node.localName.length, 1, 64); requireProfile(XML_NAME.test(node.localName)); scalar(node.namespaceUri);
    requireProfile(NAMESPACES.has(node.namespaceUri)); uris.add(node.namespaceUri);
    bytes = add(bytes, 2 * qnameBound(node.namespaceUri, node.localName) + 5, MAX_ZIP);
    if (['text', 'deletedText', 'instrText'].includes(node.kind)) bytes = add(bytes, 21, MAX_ZIP);
    const names = new Set<string>(), prefixes = new Set<string>();
    for (const attr of node.attributes) {
      bounded(attr.localName.length, 1, 64); requireProfile(XML_NAME.test(attr.localName)); scalar(attr.namespaceUri);
      requireProfile(attr.namespaceUri === '' || NAMESPACES.has(attr.namespaceUri));
      const key = `${attr.namespaceUri}:${attr.localName}`; requireProfile(!names.has(key)); names.add(key);
      scalar(attr.value, is(node, WP, 'docPr') && attr.namespaceUri === '' && attr.localName === 'descr' ? 2048 : 1024);
      if (attr.namespaceUri) uris.add(attr.namespaceUri);
      bytes = add(bytes, qnameBound(attr.namespaceUri, attr.localName) + 4 + 6 * attr.value.length, MAX_ZIP);
    }
    for (const binding of node.namespaceBindings) {
      bounded(binding.prefix.length, 0, 64); requireProfile(binding.prefix === '' || XML_NAME.test(binding.prefix));
      scalar(binding.namespaceUri); requireProfile(NAMESPACES.has(binding.namespaceUri));
      requireProfile(binding.prefix !== 'xmlns' && (binding.prefix === 'xml') === (binding.namespaceUri === XML));
      requireProfile(!prefixes.has(binding.prefix)); prefixes.add(binding.prefix);
      totals.bindings = add(totals.bindings, 1, 4096); uris.add(binding.namespaceUri);
      bytes = add(bytes, 10 + 3 * binding.prefix.length + 6 * binding.namespaceUri.length, MAX_ZIP);
    }
    bounded(uris.size, 0, 16);
    if (is(node, W, 'drawing')) drawings.push(node);
    if (is(node, A, 'blip')) { const id = attribute(node, 'embed', R); if (id !== undefined) embeds.add(id); }
    if (is(node, WP, 'docPr')) {
      const id = attribute(node, 'id'); requireProfile(id !== undefined && /^[1-9]\d*$/.test(id));
      const value = Number(id); requireProfile(Number.isSafeInteger(value) && value <= 4294967295); docPrIds.push(value);
    }
    bounded(node.children.length + stack.length, 0, Math.min(20000 - totals.nodes, nodeLimit - nodes));
    for (let index = node.children.length - 1; index >= 0; index--) stack.push({ node: node.children[index]!, depth: depth + 1 });
  }
  // The writer may declare each URI both at its authored site and under an allocated prefix.
  for (const uri of uris) bytes = add(bytes, 2 * (10 + 80 + 6 * uri.length), MAX_ZIP);
  return { bytes, nodes, drawings, embeds, docPrIds };
}

interface ContentTypes { defaults: Map<string, string>; overrides: Map<string, string>; bytes: number }
function contentTypes(pkg: OoxmlPackage, totals: Census, read: ImageInsertionProfileDependencies['readOoxmlPart']): ContentTypes {
  requireProfile(!pkg.parts.has(TYPES)); const bytes = pkg.partBytes.get(TYPES); requireProfile(bytes !== undefined, 'invalid-document');
  bounded(bytes.byteLength, 1, 65536);
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new ProfileRefusal('invalid-document'); }
  requireProfile(!text.includes('\r'));
  const defaults = new Map<string, string>(), overrides = new Map<string, string>();
  const parser = new SaxesParser({ xmlns: true });
  let depth = 0, nodes = 0, count = 0, bindings = 0, units = 0, namespaceUnits = 0;
  parser.on('error', () => { throw new ProfileRefusal('invalid-document'); });
  parser.on('doctype', () => requireProfile(false)); parser.on('comment', () => requireProfile(false));
  parser.on('processinginstruction', () => requireProfile(false)); parser.on('cdata', () => requireProfile(false));
  parser.on('xmldecl', declaration => requireProfile((!declaration.version || declaration.version === '1.0') &&
    (!declaration.encoding || declaration.encoding.toUpperCase() === 'UTF-8')));
  parser.on('text', value => {
    nodes = add(nodes, 1, 512); units = add(units, value.length, 65536);
    requireProfile(depth < 2 && /^[\t\n ]*$/.test(value));
  });
  parser.on('opentag', node => {
    depth = add(depth, 1, 2); count = add(count, 1, 256); nodes = add(nodes, 1, 512);
    requireProfile(node.uri === CT && node.prefix === ''); const attrs = Object.values(node.attributes); bounded(attrs.length, 0, 3);
    const values = new Map<string, string>();
    for (const attr of attrs) {
      units = add(units, attr.value.length, 65536); requireProfile(!attr.value.includes('\r'));
      if (attr.uri === 'http://www.w3.org/2000/xmlns/') {
        bindings = add(bindings, 1, 1); namespaceUnits = add(namespaceUnits, attr.value.length, 1024);
        requireProfile(depth === 1 && attr.name === 'xmlns' && attr.value === CT);
      } else { requireProfile(attr.uri === '' && attr.prefix === '' && !values.has(attr.local)); values.set(attr.local, attr.value); }
    }
    if (depth === 1) { requireProfile(node.local === 'Types' && values.size === 0 && bindings === 1); return; }
    requireProfile(values.size === 2 && values.has('ContentType'));
    const mime = values.get('ContentType')!;
    if (node.local === 'Default') {
      const extension = values.get('Extension'); requireProfile(extension !== undefined && /^[a-z0-9]{1,16}$/.test(extension) && !defaults.has(extension));
      defaults.set(extension, mime);
    } else {
      const name = values.get('PartName'); requireProfile(node.local === 'Override' && name !== undefined && pathAllowed(name) && !overrides.has(name));
      overrides.set(name, mime);
    }
  });
  parser.on('closetag', () => { depth--; }); parser.write(text).close(); requireProfile(depth === 0 && count > 0 && bindings === 1);
  const parsed = read(text, { name: TYPES, contentType: 'application/xml' }, { maxBytes: 65536, maxElements: 256 });
  requireProfile(parsed.ok, 'invalid-document'); const part = parsed.part, shape = scanPart(part, totals, 512, 3);
  bounded(shape.bytes, 0, 524288); requireProfile(is(part.root, CT, 'Types')); attributes(part.root, []); whitespace(part.root);
  requireProfile(part.root.namespaceBindings.length === 1 && part.root.namespaceBindings[0]!.prefix === '' && part.root.namespaceBindings[0]!.namespaceUri === CT);
  const actualDefaults = new Map<string, string>(), actualOverrides = new Map<string, string>();
  for (const child of elements(part.root)) {
    requireProfile(child.children.length === 0 && child.namespaceBindings.length === 0 && child.attributes.length === 2);
    requireProfile(is(child, CT, 'Default') || is(child, CT, 'Override'));
    const isDefault = is(child, CT, 'Default'), key = isDefault ? 'Extension' : 'PartName'; attributes(child, [key, 'ContentType']);
    const name = attribute(child, key), mime = attribute(child, 'ContentType'); requireProfile(name !== undefined && mime !== undefined);
    const map = isDefault ? actualDefaults : actualOverrides; requireProfile(!map.has(name)); map.set(name, mime);
  }
  for (const [left, right] of [[defaults, actualDefaults], [overrides, actualOverrides],
    [defaults, pkg.contentTypes.defaults], [overrides, pkg.contentTypes.overrides]] as const) {
    requireProfile(left.size === right.size); for (const [key, value] of left) requireProfile(right.get(key) === value);
  }
  return { defaults, overrides, bytes: Math.max(bytes.byteLength, shape.bytes) };
}

function sameStyle(left: OoxmlPart, right: OoxmlPart): boolean {
  const stack: [OoxmlNode, OoxmlNode][] = [[left.root, right.root]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (!element(a) || !element(b)) { if (element(a) || element(b) || a.value !== b.value) return false; continue; }
    if (a.namespaceUri !== b.namespaceUri || a.localName !== b.localName || a.children.length !== b.children.length ||
      a.attributes.length !== b.attributes.length || a.namespaceBindings.length !== b.namespaceBindings.length) return false;
    for (const attr of a.attributes) if (!b.attributes.some(other => other.namespaceUri === attr.namespaceUri && other.localName === attr.localName && other.value === attr.value)) return false;
    const leftUris = a.namespaceBindings.map(binding => binding.namespaceUri).sort(), rightUris = b.namespaceBindings.map(binding => binding.namespaceUri).sort();
    if (leftUris.some((uri, index) => uri !== rightUris[index])) return false;
    for (let index = a.children.length - 1; index >= 0; index--) stack.push([a.children[index]!, b.children[index]!]);
  }
  return true;
}

const PROPERTY_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  spacing: ['before', 'after', 'line', 'lineRule', 'beforeAutospacing', 'afterAutospacing'],
  ind: ['left', 'right', 'start', 'end', 'firstLine', 'hanging'], jc: ['val'], bidi: ['val'], keepNext: ['val'], keepLines: ['val'],
  widowControl: ['val'], contextualSpacing: ['val'], b: ['val'], i: ['val'], bCs: ['val'], iCs: ['val'], rtl: ['val'],
  u: ['val', 'color'], color: ['val'], sz: ['val'], szCs: ['val'], rFonts: ['ascii', 'hAnsi', 'eastAsia', 'cs'], lang: ['val', 'eastAsia', 'bidi'],
  pgSz: ['w', 'h', 'orient'], pgMar: ['top', 'right', 'bottom', 'left', 'header', 'footer', 'gutter'],
  cols: ['num', 'space', 'equalWidth'], docGrid: ['type', 'linePitch', 'charSpace']
};
const P_ORDER = ['keepNext', 'keepLines', 'widowControl', 'bidi', 'spacing', 'ind', 'contextualSpacing', 'jc'];
const R_ORDER = ['rFonts', 'b', 'bCs', 'i', 'iCs', 'color', 'sz', 'szCs', 'u', 'rtl', 'lang'];
const SECTION_ORDER = ['pgSz', 'pgMar', 'cols', 'docGrid'];
const BOOLEANS = ['bidi', 'keepNext', 'keepLines', 'widowControl', 'contextualSpacing', 'b', 'i', 'bCs', 'iCs', 'rtl'];
function integer(value: string, minimum = -1000000, maximum = 1000000): boolean {
  return /^-?(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= minimum && Number(value) <= maximum;
}
function propertyValue(local: string, name: string, value: string): boolean {
  if (BOOLEANS.includes(local) || name.endsWith('Autospacing') || name === 'equalWidth') return ['0', '1', 'true', 'false', 'on', 'off'].includes(value);
  if (local === 'rFonts') return value.length <= 64;
  if (local === 'lang') return /^[A-Za-z0-9-]{1,64}$/.test(value);
  if (local === 'sz' || local === 'szCs') return integer(value, 2, 3276);
  if (local === 'color' || name === 'color') return value === 'auto' || /^[0-9A-Fa-f]{6}$/.test(value);
  if (local === 'u') return ['none', 'single', 'double'].includes(value);
  if (local === 'jc') return ['left', 'right', 'center', 'both', 'start', 'end'].includes(value);
  if (name === 'lineRule') return ['auto', 'exact', 'atLeast'].includes(value);
  if (name === 'orient') return ['portrait', 'landscape'].includes(value);
  if (local === 'docGrid' && name === 'type') return ['default', 'lines', 'linesAndChars', 'snapToChars'].includes(value);
  if (local === 'cols' && name === 'num') return integer(value, 1, 64);
  if (local === 'pgSz' && (name === 'w' || name === 'h')) return integer(value, 1);
  return integer(value, local === 'spacing' ? 0 : -1000000);
}
function properties(node: OoxmlElement, order: readonly string[]): void {
  attributes(node, []); whitespace(node); let previous = -1;
  for (const child of elements(node)) {
    const rank = order.indexOf(child.localName); requireProfile(child.namespaceUri === W && rank > previous); previous = rank;
    requireProfile(child.children.length === 0); attributes(child, PROPERTY_ATTRIBUTES[child.localName]!, W);
    for (const attr of child.attributes) requireProfile(propertyValue(child.localName, attr.localName, attr.value));
    if (['jc', 'color', 'sz', 'szCs', 'u'].includes(child.localName)) requireProfile(attribute(child, 'val', W) !== undefined);
  }
}
function checkBody(part: OoxmlPart, target: Readonly<{ paragraphId: string; offset: number }>, candidates: ReadonlyMap<string, string>): void {
  const root = part.root; requireProfile(is(root, W, 'document')); attributes(root, []); whitespace(root);
  requireProfile(root.namespaceBindings.filter(binding => binding.namespaceUri === W14 && binding.prefix !== '').length === 1);
  const roots = elements(root); requireProfile(roots.length === 1 && is(roots[0]!, W, 'body')); const body = roots[0]!;
  attributes(body, []); whitespace(body); const paragraphs = elements(body), identities = new Set<string>();
  let paragraphCount = 0, targetText: string | undefined;
  const encountered = new Set<string>();
  for (const [index, paragraph] of paragraphs.entries()) {
    if (is(paragraph, W, 'sectPr')) { requireProfile(index === paragraphs.length - 1); properties(paragraph, SECTION_ORDER); continue; }
    requireProfile(is(paragraph, W, 'p')); paragraphCount++;
    attributes(paragraph, ['paraId', 'textId'], W14); const id = attribute(paragraph, 'paraId', W14);
    requireProfile(paragraph.attributes.length === 2 && id !== undefined && /^[0-9A-F]{8}$/.test(id) &&
      Number.parseInt(id, 16) > 0 && Number.parseInt(id, 16) < 2147483648 && id === attribute(paragraph, 'textId', W14) && !identities.has(id));
    identities.add(id); whitespace(paragraph); let text = '', drawing = false;
    for (const [runIndex, run] of elements(paragraph).entries()) {
      if (is(run, W, 'pPr')) { requireProfile(runIndex === 0); properties(run, P_ORDER); continue; }
      requireProfile(is(run, W, 'r')); attributes(run, []); whitespace(run);
      for (const [childIndex, child] of elements(run).entries()) {
        if (is(child, W, 'rPr')) { requireProfile(childIndex === 0); properties(child, R_ORDER); }
        else if (is(child, W, 't')) {
          attributes(child, ['space'], XML); const space = attribute(child, 'space', XML);
          requireProfile(space === undefined || space === 'default' || space === 'preserve');
          for (const value of child.children) {
            requireProfile(!element(value));
            if (paragraph.id === target.paragraphId) { bounded(text.length + value.value.length, 0, 4096); text += value.value; }
          }
        } else {
          requireProfile(is(child, W, 'drawing') && candidates.get(child.id) === paragraph.id && !encountered.has(child.id));
          encountered.add(child.id); drawing = true;
        }
      }
    }
    if (paragraph.id === target.paragraphId) { requireProfile(!drawing); targetText = text; }
  }
  requireProfile(paragraphCount > 0 && encountered.size === candidates.size && targetText !== undefined);
  requireProfile(Number.isSafeInteger(target.offset) && target.offset >= 0 && target.offset <= targetText.length);
  requireProfile(!(target.offset > 0 && target.offset < targetText.length &&
    /[\uD800-\uDBFF]/.test(targetText[target.offset - 1]!) && /[\uDC00-\uDFFF]/.test(targetText[target.offset]!)));
}

function relationshipTarget(owner: string, target: string): string {
  requireProfile(target.length > 0 && target.length <= 256 && !/[\\%?#:]/.test(target));
  const result = target.startsWith('/') ? target : (owner === '/' ? '/' : '/word/') + target;
  requireProfile(pathAllowed(result)); return result;
}
function checkRelationships(pkg: OoxmlPackage, names: ReadonlySet<string>, media: ReadonlySet<string>, embeds: ReadonlySet<string>): void {
  requireProfile(pkg.relationships.size <= 2);
  const owners = new Set<string>(), referenced = new Set<string>(); let styles = 0;
  for (const name of [ROOT_RELS, MAIN_RELS]) {
    const part = pkg.parts.get(name), owner = name === ROOT_RELS ? '/' : MAIN;
    const records = pkg.relationships.get(owner) ?? [];
    bounded(records.length, 0, 2048);
    if (!part) { requireProfile(name !== ROOT_RELS && records.length === 0); continue; }
    owners.add(owner); const root = part.root; requireProfile(is(root, REL, 'Relationships')); attributes(root, []); whitespace(root);
    const children = elements(root), ids = new Set<string>(); requireProfile(children.length === records.length);
    if (owner === '/') requireProfile(children.length === 1);
    for (const [index, child] of children.entries()) {
      requireProfile(is(child, REL, 'Relationship') && child.children.length === 0); attributes(child, ['Id', 'Type', 'Target', 'TargetMode']);
      const id = attribute(child, 'Id'), type = attribute(child, 'Type'), target = attribute(child, 'Target');
      const mode = attribute(child, 'TargetMode') ?? 'Internal', record = records[index]!;
      requireProfile(id !== undefined && /^rId[1-9]\d{0,8}$/.test(id) && Number(id.slice(3)) <= 999999998 && !ids.has(id)); ids.add(id);
      requireProfile(type !== undefined && target !== undefined && mode === 'Internal' && record.ownerPart === owner && record.id === id &&
        record.type === type && record.rawTarget === target && record.targetMode === mode);
      bounded(record.order, 0, 2048); const resolved = relationshipTarget(owner, target); requireProfile(names.has(resolved));
      if (owner === '/') requireProfile(type === `${R}/officeDocument` && target === 'word/document.xml');
      else if (type === `${R}/styles`) { requireProfile(resolved === STYLES); styles++; }
      else { requireProfile(type === `${R}/image` && embeds.has(id) && media.has(resolved)); referenced.add(resolved); }
    }
    if (owner === MAIN) for (const id of embeds) requireProfile(ids.has(id));
  }
  for (const [owner, records] of pkg.relationships) requireProfile(owners.has(owner) || (owner === MAIN && records.length === 0));
  requireProfile(referenced.size === media.size && styles === (names.has(STYLES) ? 1 : 0));
}

function qualify(pkg: OoxmlPackage, target: Readonly<{ paragraphId: string; offset: number }>, input: Readonly<ImageInsertionBudget>,
  dependencies: Readonly<ImageInsertionProfileDependencies>): number {
  bounded(input.mediaBytes, 1, MAX_MEDIA); bounded(input.pixelWidth, 1, 8192); bounded(input.pixelHeight, 1, 8192);
  const candidatePixels = input.pixelWidth * input.pixelHeight; bounded(candidatePixels, 1, 16000000);
  bounded(input.titleLength, 0, 256); bounded(input.descriptionLength, 0, 2048);
  requireProfile(pkg.mainDocumentPart === MAIN); bounded(pkg.parts.size, 1, 128); bounded(pkg.partBytes.size, 1, 2046);
  const names = new Set([...pkg.parts.keys(), ...pkg.partBytes.keys()]); bounded(names.size, 1, 2046);
  const folded = new Set<string>(); let rawBytes = 0;
  for (const name of names) {
    requireProfile(pathAllowed(name) && !folded.has(name.toLowerCase())); folded.add(name.toLowerCase());
    requireProfile([MAIN, STYLES, TYPES, ROOT_RELS, MAIN_RELS].includes(name) || /^\/word\/media\/[A-Za-z0-9_-]+\.(png|jpg|jpeg|gif)$/.test(name));
  }
  for (const bytes of pkg.partBytes.values()) { bounded(bytes.byteLength, 0, 8 * 1024 * 1024); rawBytes = add(rawBytes, bytes.byteLength, 32 * 1024 * 1024); }
  requireProfile(!pkg.parts.has(TYPES));
  const totals = newCensus(), sizes = new Map<string, number>(), drawings: OoxmlElement[] = [], embeds = new Set<string>(), docPrIds = new Set<number>();
  for (const [name, part] of pkg.parts) {
    requireProfile([MAIN, STYLES, ROOT_RELS, MAIN_RELS].includes(name) && part.name === name);
    const shape = scanPart(part, totals); sizes.set(name, shape.bytes); drawings.push(...shape.drawings);
    for (const id of shape.embeds) embeds.add(id);
    for (const id of shape.docPrIds) { requireProfile(!docPrIds.has(id)); docPrIds.add(id); bounded(id, 1, 4294967294); }
  }
  const ct = contentTypes(pkg, totals, dependencies.readOoxmlPart); sizes.set(TYPES, ct.bytes);
  const defaults: Readonly<Record<string, string>> = { rels: RELS_MIME, xml: 'application/xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' };
  for (const [key, value] of ct.defaults) requireProfile(Object.hasOwn(defaults, key) && defaults[key] === value);
  const media = new Set<string>(); let pixels = 0;
  for (const name of names) {
    if (name === TYPES) continue;
    let expected: string;
    if (name === MAIN) expected = MAIN_MIME;
    else if (name === STYLES) expected = STYLES_MIME;
    else if (name === ROOT_RELS || name === MAIN_RELS) expected = RELS_MIME;
    else {
      requireProfile(!pkg.parts.has(name)); const bytes = pkg.partBytes.get(name); requireProfile(bytes !== undefined, 'invalid-document');
      expected = name.endsWith('.png') ? 'image/png' : name.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
      const image = inspectDocxImage(bytes); requireProfile(image.ok, image.ok ? 'invalid-document' : image.code);
      requireProfile(image.value.mimeType === expected); pixels = add(pixels, image.value.pixels, 32000000);
      media.add(name); bounded(media.size + 1, 1, 128); sizes.set(name, bytes.byteLength);
    }
    const actual = ct.overrides.get(name) ?? ct.defaults.get(name.split('.').at(-1)!); requireProfile(actual === expected);
    if (!media.has(name)) {
      const part = pkg.parts.get(name); requireProfile(part !== undefined && part.contentType === expected);
      if (name === MAIN || name === STYLES) requireProfile(ct.overrides.get(name) === expected);
    }
  }
  for (const name of ct.overrides.keys()) requireProfile(names.has(name) && name !== TYPES);
  add(pixels, candidatePixels, 32000000); requireProfile(pkg.externalTargets.length === 0);
  checkRelationships(pkg, names, media, embeds);
  const styles = pkg.parts.get(STYLES);
  if (styles) {
    const reference = dependencies.defaultStylesPart; requireProfile(reference.name === STYLES && reference.contentType === STYLES_MIME);
    scanPart(reference, newCensus(), 1024, 32); requireProfile(sameStyle(styles, reference));
  }
  const main = pkg.parts.get(MAIN); requireProfile(main !== undefined);
  const candidates = imageCandidatesInPackage(pkg, main, { candidates: 128, attempts: 128, mediaBytes: MAX_ZIP });
  requireProfile(candidates.ok, candidates.ok ? 'unsupported' : candidates.code);
  const candidateMap = new Map<string, string>();
  for (const candidate of candidates.value) { requireProfile(!candidateMap.has(candidate.drawingId)); candidateMap.set(candidate.drawingId, candidate.paragraphId); }
  requireProfile(candidateMap.size === drawings.length && drawings.every(drawing => candidateMap.has(drawing.id)));
  checkBody(main, target, candidateMap);
  // Reserve insertion growth independently in the three XML entries the engine can update.
  const reserve = 88554 + 6 * (input.titleLength + input.descriptionLength);
  for (const name of [MAIN, TYPES, MAIN_RELS]) sizes.set(name, add(sizes.get(name) ?? 0, reserve, MAX_ZIP));
  const deflateBound = (bytes: number) => add(bytes, 5 * (1 + Math.ceil(bytes / 7000)));
  let total = 22, expanded = input.mediaBytes;
  for (const [name, bytes] of sizes) {
    bounded(bytes, 0, 8 * 1024 * 1024); expanded = add(expanded, bytes, 32 * 1024 * 1024);
    // Names are ASCII, so code-unit and UTF-8 byte lengths agree.
    total = add(total, 76 + 2 * (name.length - 1) + deflateBound(bytes), MAX_ZIP);
  }
  bounded(sizes.size + 1, 1, 2048);
  return add(total, 76 + 64 + deflateBound(input.mediaBytes), MAX_ZIP);
}

/** Qualify a bounded immutable package and its original body caret without allocating a candidate. */
export function qualifyImageInsertionPackage(pkg: OoxmlPackage, target: Readonly<{ paragraphId: string; offset: number }>,
  input: Readonly<ImageInsertionBudget>, dependencies: Readonly<ImageInsertionProfileDependencies>): DocxResult<Readonly<{ upperZipBytes: number }>> {
  try { return { ok: true, value: Object.freeze({ upperZipBytes: qualify(pkg, target, input, dependencies) }) }; }
  catch (error) { return { ok: false, code: error instanceof ProfileRefusal ? error.code : 'unsupported' }; }
}
