import { LyraResourceLimitError } from '../../../internal/resource-loader.js';

const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_FILE_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP64_U16 = 0xffff;
const ZIP64_U32 = 0xffffffff;
const ZIP_COMPRESSION_STORE = 0;
const ZIP_COMPRESSION_DEFLATE = 8;
const ZIP_FLAG_ENCRYPTED = 0x0001;
const ZIP_FLAG_DATA_DESCRIPTOR = 0x0008;
const ZIP_EXTRA_ZIP64 = 0x0001;
const ZIP_EXTRA_UNICODE_PATH = 0x7075;
const ZIP_EXTRA_AES = 0x9901;
// Bounded input views cap what one decoder step can expand.
const INFLATE_INPUT_SLICE_BYTES = 16 * 1024;
const XML_TAG_OPEN = 0x3c;

export interface ZipEntryInfo {
  name: string;
  compressedBytes: number;
  uncompressedBytes: number;
}

export interface ZipEntryInspector {
  write(chunk: Uint8Array): void;
  close(): void;
}

export interface ZipArchiveGuardOptions {
  description: string;
  maxEntries: number;
  maxUncompressedBytes: number;
  maxEntryBytes?: number;
  verifyCrc?: boolean;
  allowNonZip?: boolean;
  signal?: AbortSignal;
  createInspector?: (entry: ZipEntryInfo) => ZipEntryInspector | undefined;
}

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function updateCrc32(crc: number, chunk: Uint8Array): number {
  for (const byte of chunk) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 255]!;
  return crc >>> 0;
}

interface ParsedZipEntry extends ZipEntryInfo {
  dir: boolean;
  flags: number;
  compression: number;
  crc: number;
  nameOffset: number;
  nameLength: number;
  localOffset: number;
  dataOffset: number;
}

/** Immutable central-directory entry metadata safe to expose without an archive peer. */
interface ZipArchiveEntryMetadata extends ZipEntryInfo {
  readonly dir: boolean;
}

/** Immutable, bounded archive listing produced by the owned ZIP parser. */
export interface ZipArchiveMetadata {
  readonly entries: readonly ZipArchiveEntryMetadata[];
  readonly totalUncompressedBytes: number;
}

interface ParsedZipArchiveMetadata {
  view: DataView;
  directoryOffset: number;
  entries: ParsedZipEntry[];
}

export interface XmlComplexityLimits {
  includeEntry: (name: string) => boolean;
  maxNodes: number;
  maxRows?: number;
  maxCells?: number;
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** JSZip 3.8+ entry-name normalisation: drops "." and inner empty segments, resolves "..". */
function resolveArchivePath(path: string): string {
  const parts = path.split('/');
  const resolved: string[] = [];
  parts.forEach((part, index) => {
    if (part === '.' || (part === '' && index !== 0 && index !== parts.length - 1)) return;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  });
  return resolved.join('/');
}

/** Names a peer may resolve an entry under: stored, JSZip-normalised, and with `\` as `/`. */
export function zipEntryLookupNames(name: string): string[] {
  return [...new Set([name, resolveArchivePath(name), resolveArchivePath(name.replace(/\\/g, '/'))])];
}

function isElementNameStart(byte: number): boolean {
  return (byte >= 0x61 && byte <= 0x7a)
    || (byte >= 0x41 && byte <= 0x5a)
    || byte === 0x5f
    || byte === 0x3a
    || byte >= 0x80;
}

function isElementNameByte(byte: number): boolean {
  return isElementNameStart(byte) || (byte >= 0x30 && byte <= 0x39) || byte === 0x2d || byte === 0x2e;
}

function bytesEqual(source: ArrayBuffer, first: number, second: number, length: number): boolean {
  const bytes = new Uint8Array(source);
  for (let index = 0; index < length; index++) {
    if (bytes[first + index] !== bytes[second + index]) return false;
  }
  return true;
}

/** Scanner position: in text, just after `<`, or inside an element name. */
type TagScanState = 'text' | 'open' | 'name';

/**
 * Creates per-entry streaming XML inspectors backed by one archive-wide complexity budget.
 * Every `<` + name-start byte counts as an element: an upper bound for every peer's parser.
 */
export function createXmlComplexityInspectorFactory(
  limits: XmlComplexityLimits,
): (entry: ZipEntryInfo) => ZipEntryInspector | undefined {
  let nodes = 0;
  let rows = 0;
  let cells = 0;

  const fail = (): never => {
    throw new LyraResourceLimitError('The expanded archive contains too many document nodes.');
  };

  return (entry) => {
    if (!zipEntryLookupNames(entry.name).some((name) => limits.includeEntry(name))) return undefined;
    let state: TagScanState = 'text';
    // Local-name length and last three lower-cased bytes, to spot `row` and `c`.
    let localLength = 0;
    let localTail = 0;

    const startElement = (byte: number): void => {
      nodes++;
      if (nodes > limits.maxNodes) fail();
      state = 'name';
      localLength = 0;
      localTail = 0;
      continueName(byte);
    };

    const continueName = (byte: number): void => {
      if (byte === 0x3a) {
        localLength = 0;
        localTail = 0;
        return;
      }
      localLength++;
      localTail = ((localTail << 8) | (byte >= 0x41 && byte <= 0x5a ? byte | 0x20 : byte)) & 0xffffff;
    };

    const finishName = (): void => {
      state = 'text';
      if (localLength === 3 && localTail === 0x726f77) rows++;
      else if (localLength === 1 && localTail === 0x63) cells++;
      else return;
      if (
        (limits.maxRows !== undefined && rows > limits.maxRows)
        || (limits.maxCells !== undefined && cells > limits.maxCells)
      ) {
        fail();
      }
    };

    const consume = (chunk: Uint8Array): void => {
      let index = 0;
      while (index < chunk.length) {
        if (state === 'name') {
          const byte = chunk[index]!;
          if (!isElementNameByte(byte)) {
            finishName();
            continue;
          }
          continueName(byte);
          index++;
          continue;
        }
        if (state === 'open') {
          const byte = chunk[index]!;
          if (isElementNameStart(byte)) {
            startElement(byte);
            index++;
          } else {
            // Reconsider this byte as text: it may itself open the next tag.
            state = 'text';
          }
          continue;
        }
        const tagOpen = chunk.indexOf(XML_TAG_OPEN, index);
        if (tagOpen < 0) return;
        state = 'open';
        index = tagOpen + 1;
      }
    };

    return {
      write(chunk) {
        consume(chunk);
      },
      close() {
        if (state === 'name') finishName();
        state = 'text';
      },
    };
  };
}

/** Extra fields may only restate the measured name and sizes (peers rename and resize by them). */
function assertExtraFields(
  source: ArrayBuffer,
  view: DataView,
  start: number,
  length: number,
  entry: { nameOffset: number; nameLength: number; compressedBytes: number; uncompressedBytes: number },
  description: string,
): void {
  const end = start + length;
  let offset = start;
  while (offset + 4 <= end) {
    const id = view.getUint16(offset, true);
    const fieldLength = view.getUint16(offset + 2, true);
    const dataOffset = offset + 4;
    if (dataOffset + fieldLength > end) {
      throw new LyraResourceLimitError(`The ${description} archive is malformed.`);
    }
    if (id === ZIP_EXTRA_AES) {
      throw new LyraResourceLimitError(`Encrypted ${description} entries are not supported.`);
    }
    if (id === ZIP_EXTRA_ZIP64) {
      const declared = [entry.uncompressedBytes, entry.compressedBytes];
      for (let slot = 0; slot < declared.length; slot++) {
        const at = dataOffset + slot * 8;
        if (at + 8 > end) break;
        const value = view.getUint32(at, true) + view.getUint32(at + 4, true) * 2 ** 32;
        if (value !== 0 && value !== declared[slot]) {
          throw new LyraResourceLimitError(`The ${description} archive is malformed or uses ZIP64.`);
        }
      }
    }
    if (
      id === ZIP_EXTRA_UNICODE_PATH
      && (fieldLength < 5 || (view.getUint8(dataOffset) === 1 && (
        fieldLength - 5 !== entry.nameLength
        || !bytesEqual(source, dataOffset + 5, entry.nameOffset, entry.nameLength)
      )))
    ) {
      throw new LyraResourceLimitError(`The ${description} archive is malformed.`);
    }
    offset = dataOffset + fieldLength;
  }
}

function parseZipArchiveMetadata(
  source: ArrayBuffer,
  options: ZipArchiveGuardOptions,
): ParsedZipArchiveMetadata | null {
  throwIfAborted(options.signal);
  if (source.byteLength < 4) {
    if (options.allowNonZip) return null;
    throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
  }
  const view = new DataView(source);
  const firstSignature = view.getUint32(0, true);
  // A valid empty ZIP consists only of its end-of-central-directory record. It has no local-file
  // record to place at byte zero, but still has a strict byte-zero archive signature.
  if (firstSignature !== ZIP_LOCAL_FILE_SIGNATURE && firstSignature !== ZIP_END_SIGNATURE) {
    if (options.allowNonZip) {
      // Legacy non-ZIP formats may deliberately share this guard, but a ZIP signature appearing
      // after byte zero is not such a format: it is a prefixed/polyglot ZIP and must not bypass the
      // archive ceilings merely because the first four bytes describe something else.
      for (let offset = 1; offset <= source.byteLength - 4; offset++) {
        const signature = view.getUint32(offset, true);
        if (signature === ZIP_LOCAL_FILE_SIGNATURE || signature === ZIP_END_SIGNATURE) {
          throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
        }
      }
      return null;
    }
    throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
  }

  const minimumEndOffset = Math.max(0, source.byteLength - 65_557);
  let endOffset = -1;
  for (let offset = source.byteLength - 22; offset >= minimumEndOffset; offset--) {
    if (
      view.getUint32(offset, true) === ZIP_END_SIGNATURE
      && offset + 22 + view.getUint16(offset + 20, true) === source.byteLength
    ) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
  // Peers open the last end-record signature, so none may follow this one.
  for (let offset = endOffset + 1; offset <= source.byteLength - 4; offset++) {
    if (view.getUint32(offset, true) === ZIP_END_SIGNATURE) {
      throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
    }
  }

  const entryCount = view.getUint16(endOffset + 10, true);
  const entriesOnDisk = view.getUint16(endOffset + 8, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  const directoryOffset = view.getUint32(endOffset + 16, true);
  if (entryCount === ZIP64_U16 || directorySize === ZIP64_U32 || directoryOffset === ZIP64_U32) {
    throw new LyraResourceLimitError(`ZIP64 ${options.description} archives are not supported.`);
  }
  if (
    view.getUint16(endOffset + 4, true) !== 0
    || view.getUint16(endOffset + 6, true) !== 0
    || entriesOnDisk !== entryCount
  ) {
    throw new LyraResourceLimitError(`Multi-disk ${options.description} archives are not supported.`);
  }
  if (entryCount > options.maxEntries) {
    throw new LyraResourceLimitError(`The ${options.description} archive contains too many entries.`);
  }
  // JSZip re-bases every offset by a gap before the end record.
  if (directoryOffset + directorySize !== endOffset) {
    throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
  }

  const entries: ParsedZipEntry[] = [];
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  let offset = directoryOffset;
  let declaredBytes = 0;
  for (let index = 0; index < entryCount; index++) {
    throwIfAborted(options.signal);
    if (offset + 46 > endOffset || view.getUint32(offset, true) !== ZIP_CENTRAL_FILE_SIGNATURE) {
      throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
    }
    const compressedBytes = view.getUint32(offset + 20, true);
    const uncompressedBytes = view.getUint32(offset + 24, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (
      compressedBytes === ZIP64_U32
      || uncompressedBytes === ZIP64_U32
      || localOffset === ZIP64_U32
      || nextOffset > directoryOffset + directorySize
    ) {
      throw new LyraResourceLimitError(`The ${options.description} archive is malformed or uses ZIP64.`);
    }
    declaredBytes += uncompressedBytes;
    if (options.maxEntryBytes !== undefined && uncompressedBytes > options.maxEntryBytes) {
      throw new LyraResourceLimitError(`The ${options.description} archive contains an oversized entry.`);
    }
    if (declaredBytes > options.maxUncompressedBytes) {
      throw new LyraResourceLimitError(`The expanded ${options.description} archive is too large.`);
    }
    const nameBytes = new Uint8Array(source, offset + 46, nameLength);
    let name: string;
    try {
      name = utf8.decode(nameBytes);
    } catch {
      throw new LyraResourceLimitError(`The ${options.description} archive has an invalid entry name.`);
    }
    if (!name || name.includes('\0')) {
      throw new LyraResourceLimitError(`The ${options.description} archive has an invalid entry name.`);
    }
    assertExtraFields(
      source,
      view,
      offset + 46 + nameLength,
      extraLength,
      { nameOffset: offset + 46, nameLength, compressedBytes, uncompressedBytes },
      options.description,
    );
    const externalAttributes = view.getUint32(offset + 38, true);
    const unixMode = externalAttributes >>> 16;
    entries.push({
      name,
      dir: name.endsWith('/')
        || (externalAttributes & 0x10) !== 0
        || (unixMode & 0xf000) === 0x4000,
      flags: view.getUint16(offset + 8, true),
      compression: view.getUint16(offset + 10, true),
      crc: view.getUint32(offset + 16, true),
      compressedBytes,
      uncompressedBytes,
      nameOffset: offset + 46,
      nameLength,
      localOffset,
      dataOffset: -1,
    });
    offset = nextOffset;
  }
  if (offset !== directoryOffset + directorySize) {
    throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
  }

  assertLocalRecords(source, view, directoryOffset, entries, options);
  return { view, directoryOffset, entries };
}

/** Local headers must restate their central records (peers read them) and entries may not overlap. */
function assertLocalRecords(
  source: ArrayBuffer,
  view: DataView,
  directoryOffset: number,
  entries: ParsedZipEntry[],
  options: ZipArchiveGuardOptions,
): void {
  const malformed = (): LyraResourceLimitError =>
    new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
  for (const entry of entries) {
    if (
      entry.localOffset + 30 > directoryOffset
      || view.getUint32(entry.localOffset, true) !== ZIP_LOCAL_FILE_SIGNATURE
    ) {
      throw malformed();
    }
    const localFlags = view.getUint16(entry.localOffset + 6, true);
    if (((entry.flags | localFlags) & ZIP_FLAG_ENCRYPTED) !== 0) {
      throw new LyraResourceLimitError(`Encrypted ${options.description} entries are not supported.`);
    }
    const localNameLength = view.getUint16(entry.localOffset + 26, true);
    const localExtraLength = view.getUint16(entry.localOffset + 28, true);
    const dataOffset = entry.localOffset + 30 + localNameLength + localExtraLength;
    if (
      dataOffset + entry.compressedBytes > directoryOffset
      || localNameLength !== entry.nameLength
      || !bytesEqual(source, entry.localOffset + 30, entry.nameOffset, localNameLength)
    ) {
      throw malformed();
    }
    const descriptor = ((entry.flags | localFlags) & ZIP_FLAG_DATA_DESCRIPTOR) !== 0;
    for (const [field, expected] of [
      [14, entry.crc],
      [18, entry.compressedBytes],
      [22, entry.uncompressedBytes],
    ] as const) {
      const actual = view.getUint32(entry.localOffset + field, true);
      if (actual !== expected && !(descriptor && actual === 0)) throw malformed();
    }
    assertExtraFields(
      source,
      view,
      entry.localOffset + 30 + localNameLength,
      localExtraLength,
      entry,
      options.description,
    );
    entry.dataOffset = dataOffset;
  }
  const ordered = [...entries].sort((first, second) => first.localOffset - second.localOffset);
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1]!;
    if (previous.dataOffset + previous.compressedBytes > ordered[index]!.localOffset) throw malformed();
  }
}

/**
 * Validates classic single-disk ZIP metadata and enforces declared entry and expansion ceilings
 * without inflating an entry or passing the archive to an optional parser.
 */
export function assertZipArchiveMetadataWithinLimits(
  source: ArrayBuffer,
  options: ZipArchiveGuardOptions,
): ZipArchiveMetadata | null {
  const metadata = parseZipArchiveMetadata(source, options);
  if (!metadata) return null;
  const { view, entries } = metadata;
  for (const entry of entries) {
    const localCompression = view.getUint16(entry.localOffset + 8, true);
    if (
      localCompression !== entry.compression
      || (entry.compression !== ZIP_COMPRESSION_STORE && entry.compression !== ZIP_COMPRESSION_DEFLATE)
    ) {
      throw new LyraResourceLimitError(`The ${options.description} archive uses an unsupported or inconsistent compression method.`);
    }
  }
  return Object.freeze({
    entries: Object.freeze(entries.map((entry) => Object.freeze({
      name: entry.name,
      dir: entry.dir,
      compressedBytes: entry.compressedBytes,
      uncompressedBytes: entry.uncompressedBytes,
    }))),
    totalUncompressedBytes: entries.reduce((total, entry) => total + entry.uncompressedBytes, 0),
  });
}

/**
 * Validates and measures a classic single-disk ZIP before an optional document peer expands it.
 * Stored entries are inspected through zero-copy ArrayBuffer views; DEFLATE entries are inspected
 * chunk-by-chunk, with an abort/generation boundary immediately after every stream await.
 */
export async function assertZipArchiveWithinLimits(
  source: ArrayBuffer,
  options: ZipArchiveGuardOptions,
): Promise<void> {
  const metadata = parseZipArchiveMetadata(source, options);
  if (!metadata) return;
  const { view, entries } = metadata;

  let measuredBytes = 0;
  for (const entry of entries) {
    throwIfAborted(options.signal);
    if (view.getUint16(entry.localOffset + 8, true) !== entry.compression) {
      throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
    }
    const { dataOffset } = entry;
    const dataEnd = dataOffset + entry.compressedBytes;
    const inspector = options.createInspector?.(entry);
    const crc = { value: 0xffffffff };
    let actualBytes: number;
    if (entry.compression === ZIP_COMPRESSION_STORE) {
      const chunk = new Uint8Array(source, dataOffset, entry.compressedBytes);
      if (options.verifyCrc) crc.value = updateCrc32(crc.value, chunk);
      inspector?.write(chunk);
      inspector?.close();
      actualBytes = entry.compressedBytes;
    } else if (entry.compression === ZIP_COMPRESSION_DEFLATE) {
      actualBytes = await measureDeflateOutput(
        source,
        dataOffset,
        dataEnd,
        Math.min(options.maxUncompressedBytes - measuredBytes, options.maxEntryBytes ?? Number.POSITIVE_INFINITY),
        options.description,
        options.signal,
        inspector,
        options.verifyCrc ? crc : undefined,
      );
      throwIfAborted(options.signal);
    } else {
      throw new LyraResourceLimitError(`The ${options.description} archive uses an unsupported compression method.`);
    }
    measuredBytes += actualBytes;
    if (measuredBytes > options.maxUncompressedBytes) {
      throw new LyraResourceLimitError(`The expanded ${options.description} archive is too large.`);
    }
    if (actualBytes !== entry.uncompressedBytes) {
      throw new LyraResourceLimitError(`The ${options.description} archive has inconsistent entry sizes.`);
    }
    if (options.verifyCrc && ((crc.value ^ 0xffffffff) >>> 0) !== entry.crc) {
      throw new LyraResourceLimitError(`The ${options.description} archive has an invalid entry checksum.`);
    }
  }
}

async function measureDeflateOutput(
  source: ArrayBuffer,
  start: number,
  end: number,
  remainingBytes: number,
  description: string,
  signal: AbortSignal | undefined,
  inspector: ZipEntryInspector | undefined,
  crc?: { value: number },
): Promise<number> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    throwIfAborted(signal);
    const inflater = new DecompressionStream('deflate-raw' as CompressionFormat);
    const writer = inflater.writable.getWriter();
    // Backpressure: a slice is decoded only after the previous output was measured.
    void (async () => {
      for (let offset = start; offset < end; offset += INFLATE_INPUT_SLICE_BYTES) {
        await writer.write(new Uint8Array(source, offset, Math.min(INFLATE_INPUT_SLICE_BYTES, end - offset)));
      }
      await writer.close();
    })().catch(() => undefined);
    reader = inflater.readable.getReader();
    let total = 0;
    while (true) {
      const result = await reader.read();
      throwIfAborted(signal);
      if (result.done) {
        inspector?.close();
        return total;
      }
      total += result.value.byteLength;
      if (total > remainingBytes) {
        await reader.cancel();
        throwIfAborted(signal);
        throw new LyraResourceLimitError(`The expanded ${description} archive is too large.`);
      }
      inspector?.write(result.value);
      if (crc) crc.value = updateCrc32(crc.value, result.value);
    }
  } catch (error) {
    if (error instanceof LyraResourceLimitError || isAbortError(error)) throw error;
    throw new LyraResourceLimitError(`The ${description} archive contains invalid compressed data.`);
  } finally {
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
  }
}
