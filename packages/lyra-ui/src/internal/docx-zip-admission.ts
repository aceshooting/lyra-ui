/** Shared admission ceilings for DOCX rendering and editing. */
export const DOCX_ZIP_LIMITS = Object.freeze({
  input: 16 * 1024 * 1024,
  entries: 2048,
  entry: 16 * 1024 * 1024,
  expanded: 64 * 1024 * 1024,
  xml: 16 * 1024 * 1024,
  nodes: 250_000,
  depth: 128,
});

export class DocxZipAdmissionError extends Error {
  constructor(readonly code: 'invalid-document' | 'resource-limit' | 'aborted') { super(code); }
}
function fail(code: DocxZipAdmissionError['code'] = 'invalid-document'): never {
  throw new DocxZipAdmissionError(code);
}
function checkAbort(signal?: AbortSignal): void { if (signal?.aborted) fail('aborted'); }
const decoder = new TextDecoder('utf-8', { fatal: true });

export interface DocxZipEntry { name: string; size: number; packed: number; crc: number; method: number; flags: number; offset: number; start: number; end: number }
export function validDocxZipName(name: string): boolean {
  return name.length > 0 && name.length <= 512 && !/[\\%\x00-\x20\x7f:?#]/.test(name) &&
    !name.startsWith('/') && name.split('/').every((part, i, all) => part !== '.' && part !== '..' && (part !== '' || i === all.length - 1));
}
export function inspectDocxZip(bytes: Uint8Array, signal?: AbortSignal, requireParts = true): DocxZipEntry[] {
  checkAbort(signal);
  if (bytes.length > DOCX_ZIP_LIMITS.input) fail('resource-limit');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  let eocd = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
    if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === bytes.length) { eocd = at; break; }
  }
  if (eocd < 0) fail();
  const count = u16(eocd + 10), centralSize = u32(eocd + 12), central = u32(eocd + 16);
  if (u16(eocd + 4) || u16(eocd + 6) || u16(eocd + 8) !== count || count === 65535 || central === 0xffffffff || centralSize === 0xffffffff) fail();
  if (count > DOCX_ZIP_LIMITS.entries) fail('resource-limit');
  if (central + centralSize !== eocd) fail();
  const entries: DocxZipEntry[] = [], names = new Set<string>();
  let at = central, expanded = 0;
  function extra(start: number, size: number, name: string): void {
    const end = start + size;
    while (start < end) {
      if (start + 4 > end) fail();
      const id = u16(start), length = u16(start + 2);
      if (id === 1 || id === 0x9901 || start + 4 + length > end) fail();
      // An Info-ZIP Unicode path is admitted only when it spells exactly the validated UTF-8 name.
      if (id === 0x7075 && (length < 5 || bytes[start + 4] !== 1 ||
        decoder.decode(bytes.subarray(start + 9, start + 4 + length)) !== name)) fail();
      start += 4 + length;
    }
  }
  for (let i = 0; i < count; i++) {
    checkAbort(signal);
    if (at + 46 > eocd || u32(at) !== 0x02014b50) fail();
    const flags = u16(at + 8), method = u16(at + 10), crc = u32(at + 16), packed = u32(at + 20), size = u32(at + 24);
    const nameSize = u16(at + 28), extraSize = u16(at + 30), commentSize = u16(at + 32), offset = u32(at + 42);
    if ((flags & ~0x080e) || (method !== 0 && method !== 8) || u16(at + 34) || size === 0xffffffff || packed === 0xffffffff || offset === 0xffffffff) fail();
    if (at + 46 + nameSize + extraSize + commentSize > eocd) fail();
    const nameBytes = bytes.subarray(at + 46, at + 46 + nameSize);
    if (!(flags & 0x800) && nameBytes.some(byte => byte > 127)) fail();
    const name = decoder.decode(nameBytes);
    if (!validDocxZipName(name) || names.has(name.toLowerCase()) || (name.endsWith('/') && size !== 0)) fail();
    names.add(name.toLowerCase());
    if (size > DOCX_ZIP_LIMITS.entry || (expanded += size) > DOCX_ZIP_LIMITS.expanded) fail('resource-limit');
    extra(at + 46 + nameSize, extraSize, name);
    if (offset + 30 > central || u32(offset) !== 0x04034b50 || u16(offset + 6) !== flags || u16(offset + 8) !== method) fail();
    const localNameSize = u16(offset + 26), localExtraSize = u16(offset + 28);
    const start = offset + 30 + localNameSize + localExtraSize;
    if (start + packed > central || localNameSize !== nameSize || !nameBytes.every((byte, j) => bytes[offset + 30 + j] === byte)) fail();
    extra(offset + 30 + localNameSize, localExtraSize, name);
    const descriptor = Boolean(flags & 8);
    for (const [position, expected] of [[14, crc], [18, packed], [22, size]] as const) {
      const actual = u32(offset + position);
      if (actual !== expected && (!descriptor || actual !== 0)) fail();
    }
    let end = start + packed;
    if (descriptor) {
      if (end + 12 > central) fail();
      if (u32(end) === 0x08074b50) end += 4;
      if (end + 12 > central || u32(end) !== crc || u32(end + 4) !== packed || u32(end + 8) !== size) fail();
      end += 12;
    }
    if (method === 0 && packed !== size) fail();
    entries.push({ name, flags, size, packed, crc, method, offset, start, end });
    at += 46 + nameSize + extraSize + commentSize;
  }
  if (at !== eocd) fail();
  let end = 0;
  for (const entry of [...entries].sort((a, b) => a.offset - b.offset)) {
    if (entry.offset !== end) fail();
    end = entry.end;
  }
  if (end !== central) fail();
  if (requireParts) {
    for (const name of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
      if (!entries.some(entry => entry.name === name)) fail();
    }
  }
  return entries;
}
