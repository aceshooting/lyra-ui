import { LyraResourceLimitError } from '../../../internal/resource-loader.js';

const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_FILE_SIGNATURE = 0x02014b50;
const ZIP_END_SIGNATURE = 0x06054b50;
const ZIP64_U16 = 0xffff;
const ZIP64_U32 = 0xffffffff;
const ZIP_COMPRESSION_STORE = 0;
const ZIP_COMPRESSION_DEFLATE = 8;

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
  allowNonZip?: boolean;
  signal?: AbortSignal;
  createInspector?: (entry: ZipEntryInfo) => ZipEntryInspector | undefined;
}

interface ParsedZipEntry extends ZipEntryInfo {
  flags: number;
  compression: number;
  localOffset: number;
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

/**
 * Creates per-entry streaming XML inspectors backed by one archive-wide complexity budget.
 * Tokenization keeps only a short opening-tag prefix, so a large text node or attribute cannot
 * become a second unbounded allocation while the ZIP output itself is being measured.
 */
export function createXmlComplexityInspectorFactory(
  limits: XmlComplexityLimits,
): (entry: ZipEntryInfo) => ZipEntryInspector | undefined {
  let nodes = 0;
  let rows = 0;
  let cells = 0;

  return (entry) => {
    if (!limits.includeEntry(entry.name)) return undefined;
    const decoder = new TextDecoder();
    let insideTag = false;
    let quote: '"' | "'" | null = null;
    let prefix = '';

    const finishTag = (): void => {
      const match = /^<([A-Za-z_][\w:.-]*)(?:\s|\/|$)/.exec(prefix);
      if (!match) return;
      const localName = match[1]!.split(':').at(-1)!.toLocaleLowerCase('en-US');
      nodes++;
      if (localName === 'row') rows++;
      if (localName === 'c') cells++;
      if (
        nodes > limits.maxNodes
        || (limits.maxRows !== undefined && rows > limits.maxRows)
        || (limits.maxCells !== undefined && cells > limits.maxCells)
      ) {
        throw new LyraResourceLimitError('The expanded archive contains too many document nodes.');
      }
    };

    const consume = (text: string): void => {
      for (const character of text) {
        if (!insideTag) {
          if (character === '<') {
            insideTag = true;
            quote = null;
            prefix = '<';
          }
          continue;
        }
        if (quote) {
          if (character === quote) quote = null;
          if (prefix.length < 256) prefix += character;
          continue;
        }
        if (character === '"' || character === "'") {
          quote = character;
          if (prefix.length < 256) prefix += character;
          continue;
        }
        if (character === '>') {
          finishTag();
          insideTag = false;
          prefix = '';
          continue;
        }
        if (prefix.length < 256) prefix += character;
      }
    };

    return {
      write(chunk) {
        consume(decoder.decode(chunk, { stream: true }));
      },
      close() {
        consume(decoder.decode());
      },
    };
  };
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
  throwIfAborted(options.signal);
  if (source.byteLength < 4) {
    if (options.allowNonZip) return;
    throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
  }
  const view = new DataView(source);
  if (view.getUint32(0, true) !== ZIP_LOCAL_FILE_SIGNATURE) {
    if (options.allowNonZip) return;
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
  if (directoryOffset + directorySize > endOffset) {
    throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
  }

  const entries: ParsedZipEntry[] = [];
  const utf8 = new TextDecoder();
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
    if (declaredBytes > options.maxUncompressedBytes) {
      throw new LyraResourceLimitError(`The expanded ${options.description} archive is too large.`);
    }
    const nameBytes = new Uint8Array(source, offset + 46, nameLength);
    entries.push({
      name: utf8.decode(nameBytes),
      flags: view.getUint16(offset + 8, true),
      compression: view.getUint16(offset + 10, true),
      compressedBytes,
      uncompressedBytes,
      localOffset,
    });
    offset = nextOffset;
  }
  if (offset !== directoryOffset + directorySize) {
    throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
  }

  let measuredBytes = 0;
  for (const entry of entries) {
    throwIfAborted(options.signal);
    if (
      entry.localOffset + 30 > directoryOffset
      || view.getUint32(entry.localOffset, true) !== ZIP_LOCAL_FILE_SIGNATURE
    ) {
      throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
    }
    const localFlags = view.getUint16(entry.localOffset + 6, true);
    const localCompression = view.getUint16(entry.localOffset + 8, true);
    if ((entry.flags & 1) !== 0 || (localFlags & 1) !== 0) {
      throw new LyraResourceLimitError(`Encrypted ${options.description} entries are not supported.`);
    }
    if (localCompression !== entry.compression) {
      throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
    }
    const dataOffset = entry.localOffset
      + 30
      + view.getUint16(entry.localOffset + 26, true)
      + view.getUint16(entry.localOffset + 28, true);
    const dataEnd = dataOffset + entry.compressedBytes;
    if (dataOffset > directoryOffset || dataEnd > directoryOffset) {
      throw new LyraResourceLimitError(`The ${options.description} archive is malformed.`);
    }
    const inspector = options.createInspector?.(entry);
    let actualBytes: number;
    if (entry.compression === ZIP_COMPRESSION_STORE) {
      const chunk = new Uint8Array(source, dataOffset, entry.compressedBytes);
      inspector?.write(chunk);
      inspector?.close();
      actualBytes = entry.compressedBytes;
    } else if (entry.compression === ZIP_COMPRESSION_DEFLATE) {
      actualBytes = await measureDeflateOutput(
        source,
        dataOffset,
        dataEnd,
        options.maxUncompressedBytes - measuredBytes,
        options.description,
        options.signal,
        inspector,
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
): Promise<number> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    throwIfAborted(signal);
    const compressed = new Blob([source.slice(start, end)]).stream();
    const inflated = compressed.pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat));
    reader = inflated.getReader();
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
    }
  } catch (error) {
    if (error instanceof LyraResourceLimitError || isAbortError(error)) throw error;
    throw new LyraResourceLimitError(`The ${description} archive contains invalid compressed data.`);
  } finally {
    reader?.releaseLock();
  }
}
