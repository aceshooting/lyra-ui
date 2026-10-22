import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { selectTestFont } from '../scripts/browser-font.mjs';

/** An sfnt header followed by table records `[offset, length]` and zero padding up to `size` bytes. */
function sfnt(tables, size, { magic = 0x00010000, declared = tables.length } = {}) {
  const bytes = Buffer.alloc(size);
  bytes.writeUInt32BE(magic);
  bytes.writeUInt16BE(declared, 4);
  tables.forEach(([offset, length], index) => {
    bytes.writeUInt32BE(offset, 12 + index * 16 + 8);
    bytes.writeUInt32BE(length, 12 + index * 16 + 12);
  });
  return bytes;
}

test('only a bounded standalone TrueType file is selected, from the first usable candidate', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'map-font-bounds-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const write = async (name, bytes) => {
    const path = join(directory, name);
    await writeFile(path, bytes);
    return path;
  };
  const rejected = [
    await write('tiny.ttf', Buffer.from('OTTO')),
    await write('opentype-cff.otf', sfnt([[28, 4]], 32, { magic: 0x4f54544f })),
    await write('no-tables.ttf', sfnt([], 32)),
    await write('cut-directory.ttf', sfnt([[44, 4]], 40, { declared: 3 })),
    await write('table-inside-directory.ttf', sfnt([[20, 4]], 32)),
    await write('table-past-end.ttf', sfnt([[28, 40]], 32)),
  ];
  const first = await write('first.ttf', sfnt([[28, 4]], 32));
  const second = await write('second.ttf', sfnt([[44, 4], [48, 8]], 64));
  const selected = await selectTestFont([undefined, '', ...rejected, rejected[0], first, second]);
  assert.deepEqual(selected, { path: first, bytes: 32, sha256: createHash('sha256').update(sfnt([[28, 4]], 32)).digest('hex') });
  assert.equal((await selectTestFont([second])).bytes, 64, 'a later candidate is chosen when it is the only usable one');
  for (const candidates of [[], [undefined, ''], rejected]) {
    await assert.rejects(selectTestFont(candidates), /No standalone TrueType test font found\. Set MAP_TEST_FONT/u);
  }
});
