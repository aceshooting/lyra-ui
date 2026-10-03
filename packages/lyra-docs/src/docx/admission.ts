import { Inflate } from 'fflate';
import { SaxesParser } from 'saxes';
import { isSafeDocxHyperlink } from './hyperlink-policy.js';
import type { DocxRefusalCode, DocxResult } from './types.js';

const MiB = 1024 * 1024;
const LIMITS = { input: 4 * MiB, entries: 2048, entry: 8 * MiB, expanded: 32 * MiB, xml: 4 * MiB, nodes: 150_000, depth: 128, image: 4 * MiB, dimension: 8192, pixels: 16_000_000, totalPixels: 32_000_000, images: 128 };
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
async function checkpoint(signal?: AbortSignal): Promise<void> {
  check(signal);
  await new Promise<void>(resolve => setTimeout(resolve, 0));
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
  function extra(start: number, size: number): void {
    const end = start + size;
    while (start < end) {
      if (start + 4 > end) reject();
      const id = u16(start), length = u16(start + 2);
      if (id === 1 || id === 0x9901 || start + 4 + length > end) reject();
      // Alternate Unicode names can otherwise disagree with the validated UTF-8 name.
      if (id === 0x7075) reject();
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
    extra(at + 46 + nameSize, extraSize);
    if (offset + 30 > central || u32(offset) !== 0x04034b50 || u16(offset + 6) !== flags || u16(offset + 8) !== method) reject();
    const localNameSize = u16(offset + 26), localExtraSize = u16(offset + 28);
    const start = offset + 30 + localNameSize + localExtraSize;
    if (start + packed > central || localNameSize !== nameSize || !nameBytes.every((byte, j) => bytes[offset + 30 + j] === byte)) reject();
    extra(offset + 30 + localNameSize, localExtraSize);
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
    for (let offset = 0; offset < entry.packed; offset += 256) {
      if (offset % 16384 === 0) await checkpoint(signal);
      inflater.push(bytes.subarray(entry.start + offset, entry.start + Math.min(entry.packed, offset + 256)), offset + 256 >= entry.packed);
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
      if (mode === 'External') {
        if (type !== OFFICE_REL + 'hyperlink' || !isSafeDocxHyperlink(target)) reject('external-resource');
      } else if (!(type === OFFICE_REL + 'hyperlink' && target.startsWith('#'))) {
        const resolved = internalTarget(name, target);
        if (!info.names.has(resolved)) reject();
        const kind = type.slice(type.lastIndexOf('/') + 1);
        if (kind === 'image') info.images.add(resolved);
        if (['font', 'aFChunk', 'oleObject', 'package', 'control'].includes(kind)) reject();
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
  parser.on('processinginstruction', () => reject());
  for (let offset = 0; offset < text.length; offset += 16384) {
    if (offset % 262144 === 0) await checkpoint(signal);
    parser.write(text.slice(offset, offset + 16384));
  }
  parser.close();
  if (!root) reject();
}

function inspectImage(bytes: Uint8Array): number {
  if (bytes.length > LIMITS.image) reject('resource-limit');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0;
  let format: 'png' | 'gif' | 'jpeg';
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte) && view.getUint32(12) === 0x49484452) {
    format = 'png';
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes.length >= 10 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56 && (bytes[4] === 55 || bytes[4] === 57) && bytes[5] === 97) {
    format = 'gif';
    width = view.getUint16(6, true); height = view.getUint16(8, true);
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    format = 'jpeg';
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at++] !== 255) reject();
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker !== undefined && marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length) reject();
      if (marker !== undefined && [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 8) reject();
        height = view.getUint16(at + 3); width = view.getUint16(at + 5); break;
      }
      at += length;
    }
  } else reject();
  if (!width || !height) reject();
  if (width > LIMITS.dimension || height > LIMITS.dimension || width * height > LIMITS.pixels) reject('resource-limit');
  if (format === 'png') {
    let at = 8, ended = false;
    while (at + 12 <= bytes.length) {
      const length = view.getUint32(at), kind = view.getUint32(at + 4);
      if (at + 12 + length > bytes.length || kind === 0x6163544c) reject();
      at += 12 + length;
      if (kind === 0x49454e44) { ended = true; break; }
    }
    if (!ended || at !== bytes.length) reject();
  } else if (format === 'gif') {
    if (bytes.length < 13) reject();
    const packed = bytes[10]!;
    let at = 13 + ((packed & 128) ? 3 * (2 ** ((packed & 7) + 1)) : 0);
    let frames = 0, ended = false;
    const subblocks = (): void => {
      while (at < bytes.length) {
        const size = bytes[at++]!;
        if (size === 0) return;
        at += size;
        if (at > bytes.length) reject();
      }
      reject();
    };
    while (at < bytes.length) {
      const block = bytes[at++];
      if (block === 59) { ended = true; break; }
      if (block === 33) { at++; subblocks(); continue; }
      if (block !== 44 || at + 9 > bytes.length || ++frames > 1) reject();
      const frameWidth = view.getUint16(at + 4, true), frameHeight = view.getUint16(at + 6, true);
      if (!frameWidth || !frameHeight || frameWidth > width || frameHeight > height) reject();
      const framePacked = bytes[at + 8]!;
      at += 9 + ((framePacked & 128) ? 3 * (2 ** ((framePacked & 7) + 1)) : 0);
      at++; // LZW minimum code size precedes bounded data subblocks.
      subblocks();
    }
    if (!ended || frames !== 1 || at !== bytes.length) reject();
  }
  return width * height;
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
    const inspectUniqueImage = (name: string, payload: Uint8Array): void => {
      if (checkedImages.has(name)) return;
      checkedImages.add(name);
      if (checkedImages.size > LIMITS.images) reject('resource-limit');
      totalPixels += inspectImage(payload);
      if (totalPixels > LIMITS.totalPixels) reject('resource-limit');
    };
    for (const entry of entries) {
      check(signal);
      if (entry === content) continue;
      const expanded = await expand(bytes, entry, signal);
      if (entry.name.endsWith('/')) continue;
      const type = info.overrides.get(entry.name) ?? info.defaults.get(entry.name.split('.').at(-1)!.toLowerCase()) ?? '';
      if (/\.(?:xml|rels)$/i.test(entry.name) || /(?:\+xml|\/xml)$/.test(type)) await inspectXml(expanded, entry.name, info, signal);
      if (type.startsWith('image/') || /\.(?:png|jpe?g|gif|bmp|webp|svg|tiff?|emf|wmf)$/i.test(entry.name) || entry.name.startsWith('word/media/')) inspectUniqueImage(entry.name, expanded);
      await checkpoint(signal);
    }
    // Relationships may follow their targets in ZIP order. Expand only the remaining
    // image targets again, avoiding retention of the complete expanded package.
    for (const name of info.images) {
      if (checkedImages.has(name)) continue;
      check(signal);
      const entry = entries.find(candidate => candidate.name === name)!;
      inspectUniqueImage(name, await expand(bytes, entry, signal));
      await checkpoint(signal);
    }
    if (!info.officeDocument || info.overrides.get('word/document.xml') !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml') reject();
    check(signal);
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, code: signal?.aborted ? 'aborted' : error instanceof Refusal ? error.code : 'invalid-document' };
  }
}
