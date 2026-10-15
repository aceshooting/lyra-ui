import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { selectTestFont } from '../scripts/browser-font.mjs';

test('font selection skips collections even when named .ttf and preserves candidate order', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'map-font-test-'));
  try {
    const collection = join(directory, 'collection.ttf');
    const standalone = join(directory, 'standalone.ttf');
    await writeFile(collection, Buffer.from('ttcf000000000000'));
    // A bounded sfnt table directory exercises selection; browser tests validate the real font.
    const bytes = Buffer.alloc(32);
    bytes.writeUInt32BE(0x00010000);
    bytes.writeUInt16BE(1, 4);
    bytes.write('head', 12);
    bytes.writeUInt32BE(28, 20);
    bytes.writeUInt32BE(4, 24);
    await writeFile(standalone, bytes);
    const selected = await selectTestFont([collection, standalone]);
    assert.equal(selected.path, standalone);
    assert.equal(selected.bytes, 32);
    assert.match(selected.sha256, /^[a-f0-9]{64}$/);
    await assert.rejects(selectTestFont([collection]), /standalone TrueType/);
    bytes.writeUInt32BE(100, 24);
    await writeFile(standalone, bytes);
    await assert.rejects(selectTestFont([standalone]), /standalone TrueType/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
