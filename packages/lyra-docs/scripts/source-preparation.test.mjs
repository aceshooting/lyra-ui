import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { sha256, withPreparedSource } from './engine/source.mjs';

/** A one-member source archive and the lock that pins it. */
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

const PATCH = '--- a/src/example.ts\n+++ b/src/example.ts\n@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;\n';
const PATCHED = 'export const value = 2;\n';

/** A locked archive, the patch that rewrites its one input, and the prepared result the lock expects. */
function preparedFixture(context, edit = () => {}) {
  const { archive, lock } = fixture();
  const root = mkdtempSync(join(tmpdir(), 'lyra-docx-source-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  lock.upstream.archiveUrl = 'https://example.test/source.tar.gz';
  lock.patches = [{ path: 'patches/value.patch', bytes: Buffer.byteLength(PATCH), sha256: sha256(Buffer.from(PATCH)) }];
  lock.prepared = [{ path: 'src/example.ts', bytes: Buffer.byteLength(PATCHED), sha256: sha256(Buffer.from(PATCHED)) }];
  edit(lock);
  const scripts = join(root, 'scripts');
  mkdirSync(join(scripts, 'patches'), { recursive: true });
  writeFileSync(join(scripts, 'patches/value.patch'), PATCH);
  const archivePath = join(root, 'source.tar.gz');
  writeFileSync(archivePath, archive);
  return { archive, archivePath, lock, scripts };
}

test('prepares the locked source with every patch applied in a private directory that is removed afterwards', async context => {
  const { archivePath, lock, scripts } = preparedFixture(context);
  let directory;
  const value = await withPreparedSource(lock, scripts, async prepared => {
    directory = prepared;
    assert.equal(readFileSync(join(prepared, 'src/example.ts'), 'utf8'), PATCHED);
    return 'built';
  }, archivePath);
  assert.equal(value, 'built');
  assert.equal(existsSync(directory), false);
});

test('removes the prepared directory and propagates the failure when the build throws', async context => {
  const { archivePath, lock, scripts } = preparedFixture(context);
  let directory;
  await assert.rejects(withPreparedSource(lock, scripts, prepared => {
    directory = prepared;
    throw new Error('engine build failed');
  }, archivePath), /engine build failed/u);
  assert.equal(existsSync(directory), false);
});

test('takes the archive from LYRA_DOCX_SOURCE_ARCHIVE when no path is given', async context => {
  const { archivePath, lock, scripts } = preparedFixture(context);
  const previous = process.env.LYRA_DOCX_SOURCE_ARCHIVE;
  process.env.LYRA_DOCX_SOURCE_ARCHIVE = archivePath;
  context.after(() => {
    if (previous === undefined) delete process.env.LYRA_DOCX_SOURCE_ARCHIVE; else process.env.LYRA_DOCX_SOURCE_ARCHIVE = previous;
  });
  assert.equal(await withPreparedSource(lock, scripts, prepared => readFileSync(join(prepared, 'src/example.ts'), 'utf8')), PATCHED);
});

test('refuses an archive file, patch or prepared result that differs from the lock', async context => {
  const refusals = [
    ['an archive file of another length', lock => { lock.upstream.archiveBytes += 1; }, /Unexpected archive length/u],
    ['a patch of another length', lock => { lock.patches[0].bytes += 1; }, /Unexpected source length: patches\/value\.patch/u],
    ['a patch with another digest', lock => { lock.patches[0].sha256 = '0'.repeat(64); }, /Unexpected source digest: patches\/value\.patch/u],
    ['an unsafe patch path', lock => { lock.patches[0].path = '../value.patch'; }, /Unsafe source path/u],
    ['a prepared inventory of another size', lock => { lock.prepared.push({ ...lock.prepared[0], path: 'src/other.ts' }); }, /Unexpected prepared file count/u],
    ['a prepared file that is not produced', lock => { lock.prepared[0].path = 'src/missing.ts'; }, /Missing prepared file: src\/missing\.ts/u],
    ['a prepared file with another digest', lock => { lock.prepared[0].sha256 = '1'.repeat(64); }, /Unexpected source digest: src\/example\.ts/u],
  ];
  for (const [name, edit, message] of refusals) {
    const { archivePath, lock, scripts } = preparedFixture(context, edit);
    let ran = false;
    await assert.rejects(withPreparedSource(lock, scripts, () => { ran = true; }, archivePath), message, name);
    assert.equal(ran, false, `${name}: nothing may be built from unverified source`);
  }
});

/** Replace `fetch` for one test and restore the original afterwards. */
function stubFetch(context, implementation) {
  const original = globalThis.fetch;
  globalThis.fetch = implementation;
  context.after(() => { globalThis.fetch = original; });
}

const streamOf = (...chunks) => new Response(new ReadableStream({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(chunk);
    controller.close();
  },
}));

test('downloads the locked archive in chunks when no local copy is given', async context => {
  const { archive, lock, scripts } = preparedFixture(context);
  const requests = [];
  stubFetch(context, async (url, init) => {
    requests.push({ url, signal: init.signal });
    return streamOf(archive.subarray(0, 10), archive.subarray(10));
  });
  const previous = process.env.LYRA_DOCX_SOURCE_ARCHIVE;
  delete process.env.LYRA_DOCX_SOURCE_ARCHIVE;
  context.after(() => { if (previous !== undefined) process.env.LYRA_DOCX_SOURCE_ARCHIVE = previous; });
  assert.equal(await withPreparedSource(lock, scripts, prepared => readFileSync(join(prepared, 'src/example.ts'), 'utf8')), PATCHED);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://example.test/source.tar.gz');
  assert.equal(requests[0].signal instanceof AbortSignal, true, 'the download is bounded in time');
});

test('refuses a failed download, an empty response and a body longer than the lock allows', async context => {
  const { archive, lock, scripts } = preparedFixture(context);
  const downloads = [
    [() => new Response('not found', { status: 404 }), /Source download failed \(404\)/u],
    [() => new Response(null, { status: 204 }), /Source download failed \(204\)/u],
    [() => streamOf(Buffer.concat([archive, Buffer.from('trailing bytes')])), /Source download exceeds locked length/u],
    [() => streamOf(archive.subarray(0, archive.length - 1)), /Unexpected archive length/u],
  ];
  for (const [respond, message] of downloads) {
    stubFetch(context, async () => respond());
    const previous = process.env.LYRA_DOCX_SOURCE_ARCHIVE;
    delete process.env.LYRA_DOCX_SOURCE_ARCHIVE;
    try { await assert.rejects(withPreparedSource(lock, scripts, () => 'built'), message); }
    finally { if (previous !== undefined) process.env.LYRA_DOCX_SOURCE_ARCHIVE = previous; }
  }
});

test('an explicit archive path that does not exist is an error, never a silent download', async context => {
  const { lock, scripts } = preparedFixture(context);
  stubFetch(context, async () => { throw new Error('the network must not be used'); });
  await assert.rejects(withPreparedSource(lock, scripts, () => 'built', join(dirname(scripts), 'absent-archive.tgz')), { code: 'ENOENT' });
});
