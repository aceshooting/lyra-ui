import { inflateRawSync } from 'node:zlib';

/** Read a named entry from a small test DOCX without depending on an engine parser. */
export function zipEntryBytes(bytes, name) {
  const data = Buffer.from(bytes);
  let end = -1;
  for (let offset = data.length - 22; offset >= Math.max(0, data.length - 65557); offset--) {
    if (data.readUInt32LE(offset) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new Error('ZIP end record missing');
  let offset = data.readUInt32LE(end + 16);
  const count = data.readUInt16LE(end + 10);
  for (let index = 0; index < count; index++) {
    if (data.readUInt32LE(offset) !== 0x02014b50) throw new Error('ZIP directory invalid');
    const method = data.readUInt16LE(offset + 10);
    const size = data.readUInt32LE(offset + 20);
    const fileNameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const fileName = data.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    if (fileName === name) {
      const local = data.readUInt32LE(offset + 42);
      if (data.readUInt32LE(local) !== 0x04034b50) throw new Error('ZIP local header invalid');
      const body = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
      const compressed = data.subarray(body, body + size);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);
      throw new Error(`Unsupported test ZIP method ${method}`);
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error(`ZIP entry missing: ${name}`);
}

export function zipEntry(bytes, name) {
  return zipEntryBytes(bytes, name).toString('utf8');
}
