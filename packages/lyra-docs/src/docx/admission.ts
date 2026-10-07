import { Inflate } from 'fflate';
import { SaxesParser } from 'saxes';
import { DOCX_ZIP_LIMITS, DocxZipAdmissionError, inspectDocxZip, validDocxZipName, type DocxZipEntry } from '@aceshooting/lyra-ui/utils/docx-zip-admission.js';
import { CRC32_TABLE, inspectDocxImage, isDocxMetafileSignature, isDocxRasterSignature } from './image-bytes.js';
import { isSafeDocxHyperlink } from './hyperlink-policy.js';
import { CONTENT_TYPE_NS as TYPE_NS, OFFICE_REL_NS, PACKAGE_REL_NS as REL_NS, resolveOoxmlSegments, WORD_NS } from './ooxml.js';
import type { DocxRefusalCode, DocxResult } from './types.js';

// The input cap matches the largest package the session exports, so a saved document always reopens.
const LIMITS = { ...DOCX_ZIP_LIMITS, totalPixels: 64_000_000, images: 256 };
/** External targets the engine records but never fetches: links, Word templates and linked pictures. */
const INERT_EXTERNAL = new Set(['hyperlink', 'attachedTemplate', 'image']);
/** Embedded content that can execute or import foreign markup stays refused; fonts and OLE/chart packages are opaque. */
const ACTIVE_INTERNAL = new Set(['aFChunk', 'control']);
const OFFICE_REL = `${OFFICE_REL_NS}/`;
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
type Entry = DocxZipEntry;

async function expand(bytes: Uint8Array, entry: Entry, signal?: AbortSignal): Promise<Uint8Array> {
  let size = 0, crc = 0xffffffff;
  const chunks: Uint8Array[] = [];
  const receive = (chunk: Uint8Array): void => {
    check(signal);
    size += chunk.length;
    if (size > entry.size || size > LIMITS.entry) reject('resource-limit');
    for (const byte of chunk) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 255]!;
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
  const parts = resolveOoxmlSegments(source, path);
  if (!parts) reject();
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
        if (!part.startsWith('/') || !validDocxZipName(part.slice(1)) || info.overrides.has(part.slice(1))) reject();
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
    const entries = inspectDocxZip(bytes, signal);
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
    return { ok: false, code: signal?.aborted ? 'aborted' : error instanceof Refusal || error instanceof DocxZipAdmissionError ? error.code : 'invalid-document' };
  }
}
