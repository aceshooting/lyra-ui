import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { applySourcePatch, readSourceArchive, sha256 } from './source.mjs';

function fixture({ file = 'src/example.ts', type = '0', duplicate = false } = {}) {
  const bytes = Buffer.from('export const value = 1;\n');
  const header = Buffer.alloc(512);
  header.write(`source/${file}`);
  header.write('0000644\0', 100);
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124);
  header.fill(32, 148, 156);
  header.write(type, 156);
  const checksum = [...header].reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
  const member = Buffer.concat([header, bytes, Buffer.alloc(512 - bytes.length)]);
  const archive = gzipSync(Buffer.concat([member, ...(duplicate ? [member] : []), Buffer.alloc(1024)]));
  const lock = {
    upstream: { archiveBytes: archive.length, archiveSha256: sha256(archive), archivePrefix: 'source', maxExpandedBytes: 4096 },
    inputs: [{ path: file, bytes: bytes.length, sha256: sha256(bytes), gitBlobSha1: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') }],
  };
  return { archive, lock };
}

test('admit only exact bytes from a locked regular-file member', () => {
  const { archive, lock } = fixture();
  assert.equal(readSourceArchive(archive, lock).get('src/example.ts').toString(), 'export const value = 1;\n');
  assert.throws(() => readSourceArchive(Buffer.concat([archive, Buffer.from('extra')]), lock), /archive length/u);
  const modified = Buffer.from(archive); modified[12] ^= 1;
  assert.throws(() => readSourceArchive(modified, lock), /archive digest/u);
  lock.inputs[0].sha256 = '0'.repeat(64);
  assert.throws(() => readSourceArchive(archive, lock), /source digest/u);
});

test('refuse traversal, links, duplicate members, and missing inputs', () => {
  for (const options of [{ file: '../escape.ts' }, { type: '2' }, { duplicate: true }]) {
    const { archive, lock } = fixture(options);
    assert.throws(() => readSourceArchive(archive, lock));
  }
  const { archive, lock } = fixture();
  lock.inputs[0].path = 'missing.ts';
  assert.throws(() => readSourceArchive(archive, lock), /Missing locked/u);
});

test('reject decompression beyond the source ceiling', () => {
  const { archive, lock } = fixture();
  lock.upstream.maxExpandedBytes = 512;
  assert.throws(() => readSourceArchive(archive, lock));
});

test('apply exact patch contexts and preserve new files', () => {
  const files = new Map([['src/example.ts', Buffer.from('first\nold\nlast\n')]]);
  applySourcePatch(files, '--- a/src/example.ts\n+++ b/src/example.ts\n@@ -1,3 +1,3 @@\n first\n-old\n+new\n last\n--- /dev/null\n+++ b/src/new.ts\n@@ -0,0 +1 @@\n+added\n');
  assert.equal(files.get('src/example.ts').toString(), 'first\nnew\nlast\n');
  assert.equal(files.get('src/new.ts').toString(), 'added\n');
  assert.throws(() => applySourcePatch(files, '--- a/src/example.ts\n+++ b/src/example.ts\n@@ -2 +2 @@\n-old\n+bad\n'), /context differs/u);
  assert.throws(() => applySourcePatch(files, '--- /dev/null\n+++ b/../outside.ts\n@@ -0,0 +1 @@\n+bad\n'), /Unsafe source path/u);
});
