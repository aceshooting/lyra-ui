// Test-only builder for crafted ZIP archives (APPNOTE 4.3 records).

const encoder = new TextEncoder();
let crcTable: Uint32Array | undefined;

export function crc32(bytes: Uint8Array): number {
  crcTable ??= Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFixtureEntry {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  data: Uint8Array;
}

export async function zipEntry(
  name: string,
  payload: string | Uint8Array,
  { deflate = false }: { deflate?: boolean } = {},
): Promise<ZipFixtureEntry> {
  const raw = typeof payload === 'string' ? encoder.encode(payload) : payload;
  const data = deflate
    ? new Uint8Array(await new Response(
      new Blob([new Uint8Array(raw)]).stream().pipeThrough(new CompressionStream('deflate-raw')),
    ).arrayBuffer())
    : raw;
  return {
    name,
    method: deflate ? 8 : 0,
    crc: crc32(raw),
    compressedSize: data.length,
    uncompressedSize: raw.length,
    data,
  };
}

export interface ZipHeaderOverrides {
  name?: string;
  flags?: number;
  extra?: Uint8Array;
  crc?: number;
  compressedSize?: number;
  uncompressedSize?: number;
}

/** Local file header immediately followed by the entry data. */
export function localRecord(entry: ZipFixtureEntry, overrides: ZipHeaderOverrides = {}): Uint8Array {
  const name = encoder.encode(overrides.name ?? entry.name);
  const extra = overrides.extra ?? new Uint8Array(0);
  const record = new Uint8Array(30 + name.length + extra.length + entry.data.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, overrides.flags ?? 0, true);
  view.setUint16(8, entry.method, true);
  view.setUint32(14, overrides.crc ?? entry.crc, true);
  view.setUint32(18, overrides.compressedSize ?? entry.compressedSize, true);
  view.setUint32(22, overrides.uncompressedSize ?? entry.uncompressedSize, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, extra.length, true);
  record.set(name, 30);
  record.set(extra, 30 + name.length);
  record.set(entry.data, 30 + name.length + extra.length);
  return record;
}

export function centralRecord(
  entry: ZipFixtureEntry,
  localOffset: number,
  overrides: ZipHeaderOverrides = {},
): Uint8Array {
  const name = encoder.encode(overrides.name ?? entry.name);
  const extra = overrides.extra ?? new Uint8Array(0);
  const record = new Uint8Array(46 + name.length + extra.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, overrides.flags ?? 0, true);
  view.setUint16(10, entry.method, true);
  view.setUint32(16, overrides.crc ?? entry.crc, true);
  view.setUint32(20, overrides.compressedSize ?? entry.compressedSize, true);
  view.setUint32(24, overrides.uncompressedSize ?? entry.uncompressedSize, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, extra.length, true);
  view.setUint32(42, localOffset, true);
  record.set(name, 46);
  record.set(extra, 46 + name.length);
  return record;
}

export function endRecord(
  { records, directorySize, directoryOffset, commentLength = 0 }:
  { records: number; directorySize: number; directoryOffset: number; commentLength?: number },
): Uint8Array {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, records, true);
  view.setUint16(10, records, true);
  view.setUint32(12, directorySize, true);
  view.setUint32(16, directoryOffset, true);
  view.setUint16(20, commentLength, true);
  return record;
}

/** One extra-field block: 2-byte id, 2-byte length, payload. */
export function extraField(id: number, payload: Uint8Array): Uint8Array {
  const field = new Uint8Array(4 + payload.length);
  const view = new DataView(field.buffer);
  view.setUint16(0, id, true);
  view.setUint16(2, payload.length, true);
  field.set(payload, 4);
  return field;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** An ordinary archive: local records in order, then the central directory and its end record. */
export function assembleZip(entries: readonly ZipFixtureEntry[]): ArrayBuffer {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const local = localRecord(entry);
    centrals.push(centralRecord(entry, offset));
    locals.push(local);
    offset += local.length;
  }
  const directory = concatBytes(...centrals);
  return toArrayBuffer(concatBytes(
    ...locals,
    directory,
    endRecord({ records: entries.length, directorySize: directory.length, directoryOffset: offset }),
  ));
}
