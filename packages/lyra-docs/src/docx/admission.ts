import { Inflate } from 'fflate';
import { SaxesParser } from 'saxes';
import { inspectDocxImage, isDocxMetafileSignature, isDocxRasterSignature } from './image-bytes.js';
import { isSafeDocxHyperlink } from './hyperlink-policy.js';
import type { DocxRefusalCode, DocxResult } from './types.js';

const MiB = 1024 * 1024;
// The input cap matches the largest package the session exports, so a saved document always reopens.
const LIMITS = { input: 16 * MiB, entries: 2048, entry: 16 * MiB, expanded: 64 * MiB, xml: 16 * MiB, nodes: 1_000_000, depth: 128, totalPixels: 64_000_000, images: 256 };
/** External targets the engine records but never fetches: links, Word templates and linked pictures. */
const INERT_EXTERNAL = new Set(['hyperlink', 'attachedTemplate', 'image']);
/** Embedded content that can execute or import foreign markup stays refused; fonts and OLE/chart packages are opaque. */
const ACTIVE_INTERNAL = new Set(['aFChunk', 'control']);
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPE_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const decoder = new TextDecoder('utf-8', { fatal: true });

class Refusal extends Error {
  constructor(readonly code: DocxRefusalCode) { super(code); }
}
function reject(code: DocxRefusalCode = 'invalid-document'): never { throw new Refusal(code); }
function check(signal?: AbortSignal): void { if (signal?.aborted) reject('aborted'); }
let lastYield = 0;
/** Yield to the event loop at most every 8 ms, so large packages neither block input nor crawl on timer clamping. */
async function checkpoint(signal?: AbortSignal): Promise<void> {
  check(signal);
  if (performance.now() - lastYield < 8) return;
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  lastYield = performance.now();
  check(signal);
}
interface Entry { name: string; size: number; packed: number; crc: number; method: number; flags: number; offset: number; start: number; end: number }
function validName(name: string): boolean {
  return name.length > 0 && name.length <= 512 && !/[\\%\x00-\x20\x7f:?#]/.test(name) &&
    !name.startsWith('/') && name.split('/').every((part, i, all) => part !== '.' && part !== '..' && (part !== '' || i === all.length - 1));
}
function archive(bytes: Uint8Array, signal?: AbortSignal): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  let eocd = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
    if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === bytes.length) { eocd = at; break; }
  }
  if (eocd < 0) reject();
  const count = u16(eocd + 10), centralSize = u32(eocd + 12), central = u32(eocd + 16);
  if (u16(eocd + 4) || u16(eocd + 6) || u16(eocd + 8) !== count || count === 65535 || central === 0xffffffff || centralSize === 0xffffffff) reject();
  if (count > LIMITS.entries) reject('resource-limit');
  if (central + centralSize !== eocd) reject();
  const entries: Entry[] = [], names = new Set<string>();
  let at = central, expanded = 0;
  function extra(start: number, size: number, name: string): void {
    const end = start + size;
    while (start < end) {
      if (start + 4 > end) reject();
      const id = u16(start), length = u16(start + 2);
      if (id === 1 || id === 0x9901 || start + 4 + length > end) reject();
      // An Info-ZIP Unicode path is admitted only when it spells exactly the validated UTF-8 name.
      if (id === 0x7075 && (length < 5 || bytes[start + 4] !== 1 ||
        decoder.decode(bytes.subarray(start + 9, start + 4 + length)) !== name)) reject();
      start += 4 + length;
    }
  }
  for (let i = 0; i < count; i++) {
    check(signal);
    if (at + 46 > eocd || u32(at) !== 0x02014b50) reject();
    const flags = u16(at + 8), method = u16(at + 10), crc = u32(at + 16), packed = u32(at + 20), size = u32(at + 24);
    const nameSize = u16(at + 28), extraSize = u16(at + 30), commentSize = u16(at + 32), offset = u32(at + 42);
    if ((flags & ~0x080e) || (method !== 0 && method !== 8) || u16(at + 34) || size === 0xffffffff || packed === 0xffffffff || offset === 0xffffffff) reject();
    if (at + 46 + nameSize + extraSize + commentSize > eocd) reject();
    const nameBytes = bytes.subarray(at + 46, at + 46 + nameSize);
    if (!(flags & 0x800) && nameBytes.some(byte => byte > 127)) reject();
    const name = decoder.decode(nameBytes);
    if (!validName(name) || names.has(name.toLowerCase()) || (name.endsWith('/') && size !== 0)) reject();
    names.add(name.toLowerCase());
    if (size > LIMITS.entry || (expanded += size) > LIMITS.expanded) reject('resource-limit');
    extra(at + 46 + nameSize, extraSize, name);
    if (offset + 30 > central || u32(offset) !== 0x04034b50 || u16(offset + 6) !== flags || u16(offset + 8) !== method) reject();
    const localNameSize = u16(offset + 26), localExtraSize = u16(offset + 28);
    const start = offset + 30 + localNameSize + localExtraSize;
    if (start + packed > central || localNameSize !== nameSize || !nameBytes.every((byte, j) => bytes[offset + 30 + j] === byte)) reject();
    extra(offset + 30 + localNameSize, localExtraSize, name);
    const descriptor = Boolean(flags & 8);
    for (const [position, expected] of [[14, crc], [18, packed], [22, size]] as const) {
      const actual = u32(offset + position);
      if (actual !== expected && (!descriptor || actual !== 0)) reject();
    }
    let end = start + packed;
    if (descriptor) {
      if (end + 12 > central) reject();
      if (u32(end) === 0x08074b50) end += 4;
      if (end + 12 > central || u32(end) !== crc || u32(end + 4) !== packed || u32(end + 8) !== size) reject();
      end += 12;
    }
    if (method === 0 && packed !== size) reject();
    entries.push({ name, flags, size, packed, crc, method, offset, start, end });
    at += 46 + nameSize + extraSize + commentSize;
  }
  if (at !== eocd) reject();
  let end = 0;
  for (const entry of [...entries].sort((a, b) => a.offset - b.offset)) {
    if (entry.offset !== end) reject();
    end = entry.end;
  }
  if (end !== central) reject();
  for (const name of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
    if (!entries.some(entry => entry.name === name)) reject();
  }
  return entries;
}
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
async function expand(bytes: Uint8Array, entry: Entry, signal?: AbortSignal): Promise<Uint8Array> {
  let size = 0, crc = 0xffffffff;
  const chunks: Uint8Array[] = [];
  const receive = (chunk: Uint8Array): void => {
    check(signal);
    size += chunk.length;
    if (size > entry.size || size > LIMITS.entry) reject('resource-limit');
    for (const byte of chunk) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]!;
    chunks.push(chunk);
  };
  if (entry.method === 0) receive(bytes.subarray(entry.start, entry.start + entry.packed));
  else {
    const inflater = new Inflate(receive);
    // Feeding bounded compressed slices also bounds each decoder output allocation.
    for (let offset = 0; offset < entry.packed; offset += 4096) {
      if (offset % 65536 === 0) await checkpoint(signal);
      inflater.push(bytes.subarray(entry.start + offset, entry.start + Math.min(entry.packed, offset + 4096)), offset + 4096 >= entry.packed);
    }
    if (entry.packed === 0) reject();
  }
  if (size !== entry.size || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) reject();
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

interface PackageInfo { nodes: number; defaults: Map<string, string>; overrides: Map<string, string>; names: Set<string>; images: Set<string>; officeDocument: boolean }
function internalTarget(part: string, target: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//') || target.includes('\\')) reject('external-resource');
  if (target.includes('%') || /[\x00-\x20\x7f]/.test(target)) reject();
  const path = target.split('#')[0]!;
  const source = part === '_rels/.rels' ? [] : part.replace(/_rels\/([^/]+)\.rels$/, '$1').split('/').slice(0, -1);
  const parts = path.startsWith('/') ? [] : source;
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') { if (!parts.length) reject(); parts.pop(); }
    else parts.push(segment);
  }
  return parts.join('/');
}
async function inspectXml(bytes: Uint8Array, name: string, info: PackageInfo, signal?: AbortSignal): Promise<void> {
  if (bytes.length > LIMITS.xml) reject('resource-limit');
  const text = decoder.decode(bytes);
  let depth = 0, root = false;
  const ids = new Set<string>();
  const parser = new SaxesParser({ xmlns: true });
  parser.on('error', () => reject());
  parser.on('doctype', () => reject());
  parser.on('opentag', node => {
    check(signal);
    if (++depth > LIMITS.depth || ++info.nodes > LIMITS.nodes || Object.keys(node.attributes).length > 128) reject('resource-limit');
    if (!root) {
      root = true;
      if (name === '[Content_Types].xml' && (node.local !== 'Types' || node.uri !== TYPE_NS)) reject();
      if (name.endsWith('.rels') && (node.local !== 'Relationships' || node.uri !== REL_NS)) reject();
      if (name === 'word/document.xml' && (node.local !== 'document' || node.uri !== WORD_NS)) reject();
    }
    const attr = (key: string): string => node.attributes[key]?.value ?? '';
    if (name === '[Content_Types].xml' && depth === 2) {
      if (node.uri !== TYPE_NS) reject();
      const type = attr('ContentType').trim().toLowerCase();
      if (!type) reject();
      if (node.local === 'Default') {
        const ext = attr('Extension').toLowerCase();
        if (!ext || info.defaults.has(ext)) reject();
        info.defaults.set(ext, type);
      } else if (node.local === 'Override') {
        const part = attr('PartName');
        if (!part.startsWith('/') || !validName(part.slice(1)) || info.overrides.has(part.slice(1))) reject();
        info.overrides.set(part.slice(1), type);
      } else reject();
    }
    if (name.endsWith('.rels') && depth > 1) {
      if (depth !== 2 || node.uri !== REL_NS || node.local !== 'Relationship') reject();
      const id = attr('Id'), type = attr('Type'), target = attr('Target'), mode = attr('TargetMode');
      if (!id || ids.has(id) || !type || !target || (mode && mode !== 'External' && mode !== 'Internal')) reject();
      ids.add(id);
      const kind = type.slice(type.lastIndexOf('/') + 1);
      if (mode === 'External') {
        if (!type.startsWith(OFFICE_REL) || !INERT_EXTERNAL.has(kind) ||
          (kind === 'hyperlink' && !isSafeDocxHyperlink(target))) reject('external-resource');
      } else if (!(type === OFFICE_REL + 'hyperlink' && target.startsWith('#'))) {
        const resolved = internalTarget(name, target);
        if (!info.names.has(resolved)) reject();
        if (kind === 'image' && name.startsWith('word/')) info.images.add(resolved);
        if (ACTIVE_INTERNAL.has(kind)) reject();
        if (name === '_rels/.rels' && type === OFFICE_REL + 'officeDocument') {
          if (resolved !== 'word/document.xml' || info.officeDocument) reject();
          info.officeDocument = true;
        }
      }
    }
    // Inline legacy image references can bypass OPC relationships.
    for (const attribute of Object.values(node.attributes)) {
      if (['src', 'href'].includes(attribute.local) && attribute.uri !== 'http://www.w3.org/2000/xmlns/' && attribute.value && !attribute.value.startsWith('#')) reject('external-resource');
    }
  });
  parser.on('closetag', () => { depth--; });
  const countNode = () => { if (++info.nodes > LIMITS.nodes) reject('resource-limit'); };
  parser.on('text', countNode);
  parser.on('cdata', countNode);
  parser.on('comment', countNode);
  // Office writes inert mso-* instructions (for example SharePoint content types) into custom XML parts.
  parser.on('processinginstruction', instruction => {
    if (name.startsWith('word/') || name.endsWith('.rels') || name === '[Content_Types].xml' || !instruction.target.startsWith('mso-')) reject();
  });
  for (let offset = 0; offset < text.length; offset += 16384) {
    if (offset % 262144 === 0) await checkpoint(signal);
    parser.write(text.slice(offset, offset + 16384));
  }
  parser.close();
  if (!root) reject();
}


/** Validate the complete package before any engine, decoder or resource resolver receives it. */
export async function admitDocx(bytes: Uint8Array, signal?: AbortSignal): Promise<DocxResult<void>> {
  try {
    check(signal);
    if (!(bytes instanceof Uint8Array)) reject();
    if (bytes.length > LIMITS.input) reject('resource-limit');
    const entries = archive(bytes, signal);
    await checkpoint(signal);
    const info: PackageInfo = { nodes: 0, defaults: new Map(), overrides: new Map(), names: new Set(entries.map(entry => entry.name)), images: new Set(), officeDocument: false };
    const content = entries.find(entry => entry.name === '[Content_Types].xml')!;
    await inspectXml(await expand(bytes, content, signal), content.name, info, signal);
    const checkedImages = new Set<string>();
    let totalPixels = 0;
    const typeOf = (name: string) => info.overrides.get(name) ?? info.defaults.get(name.split('.').at(-1)!.toLowerCase()) ?? '';
    // Pictures the document body references reach the browser's decoders. Bytes claiming PNG, GIF or
    // JPEG must be well formed and within pixel limits; Windows metafiles, which no browser decodes, are
    // painted as placeholders; SVG must be plain XML without external references; anything else (WebP,
    // BMP, TIFF, unknown) is refused because browsers sniff and decode it. Unreferenced images such as
    // package thumbnails are never decoded; every PNG, GIF or JPEG under word/ is still inspected.
    const inspectBodyImage = async (name: string, payload: Uint8Array): Promise<void> => {
      if (checkedImages.has(name)) return;
      checkedImages.add(name);
      if (checkedImages.size > LIMITS.images) reject('resource-limit');
      if (isDocxRasterSignature(payload)) {
        const image = inspectDocxImage(payload, { trailing: true });
        if (!image.ok) reject(image.code);
        totalPixels += image.value.pixels;
        if (totalPixels > LIMITS.totalPixels) reject('resource-limit');
      } else if (typeOf(name) === 'image/svg+xml' || /\.svg$/i.test(name)) await inspectXml(payload, name, info, signal);
      else if (!isDocxMetafileSignature(payload)) reject();
    };
    for (const entry of entries) {
      check(signal);
      if (entry === content) continue;
      const expanded = await expand(bytes, entry, signal);
      if (entry.name.endsWith('/')) continue;
      const type = typeOf(entry.name);
      if (/\.(?:xml|rels)$/i.test(entry.name) || /(?:\+xml|\/xml)$/.test(type) && type !== 'image/svg+xml') await inspectXml(expanded, entry.name, info, signal);
      if (entry.name.startsWith('word/') && isDocxRasterSignature(expanded)) await inspectBodyImage(entry.name, expanded);
      await checkpoint(signal);
    }
    // Relationships may follow their targets in ZIP order, so referenced pictures are expanded
    // again once every relationship is known, avoiding retention of the complete expanded package.
    for (const name of info.images) {
      if (checkedImages.has(name)) continue;
      check(signal);
      const entry = entries.find(candidate => candidate.name === name)!;
      await inspectBodyImage(name, await expand(bytes, entry, signal));
      await checkpoint(signal);
    }
    if (!info.officeDocument || info.overrides.get('word/document.xml') !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml') reject();
    check(signal);
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, code: signal?.aborted ? 'aborted' : error instanceof Refusal ? error.code : 'invalid-document' };
  }
}
