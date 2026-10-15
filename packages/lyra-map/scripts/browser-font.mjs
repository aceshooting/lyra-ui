import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function selectTestFont(paths) {
  for (const path of new Set(paths.filter(Boolean))) {
    const bytes = await readFile(path);
    // Fontconfig can return a TrueType collection, which FontFace cannot use as a
    // standalone font. Check the sfnt header and table bounds, not the extension.
    if (bytes.length < 12 || bytes.readUInt32BE(0) !== 0x00010000) continue;
    const count = bytes.readUInt16BE(4);
    if (!count || 12 + count * 16 > bytes.length) continue;
    let valid = true;
    for (let index = 0; index < count; index++) {
      const record = 12 + index * 16;
      const offset = bytes.readUInt32BE(record + 8);
      const length = bytes.readUInt32BE(record + 12);
      if (offset < 12 + count * 16 || offset + length > bytes.length) valid = false;
    }
    if (valid) return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  throw new Error('No standalone TrueType test font found. Set MAP_TEST_FONT to a valid .ttf file.');
}
