import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function safePath(value) {
  assert(typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.includes('\0'));
  assert(!path.posix.isAbsolute(value) && value.split('/').every(part => part && part !== '.' && part !== '..'), `Unsafe source path: ${value}`);
  return value;
}

function verify(bytes, expected) {
  assert.equal(bytes.length, expected.bytes, `Unexpected source length: ${expected.path ?? expected.specifier}`);
  assert.equal(sha256(bytes), expected.sha256, `Unexpected source digest: ${expected.path ?? expected.specifier}`);
}

/** Read only the finite, hash-locked regular-file inventory; never extract archive paths. */
export function readSourceArchive(archive, lock) {
  assert.equal(archive.length, lock.upstream.archiveBytes, 'Unexpected archive length');
  assert.equal(sha256(archive), lock.upstream.archiveSha256, 'Unexpected archive digest');
  const tar = gunzipSync(archive, { maxOutputLength: lock.upstream.maxExpandedBytes });
  const expected = new Map(lock.inputs.map(input => [safePath(input.path), input]));
  assert.equal(expected.size, lock.inputs.length, 'Duplicate source inventory entry');
  const files = new Map();
  const field = (header, start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/su, '');
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const number = (start, length) => {
      const value = field(header, start, length).trim();
      assert(/^[0-7]+$/u.test(value), 'Unsupported tar number');
      return Number.parseInt(value, 8);
    };
    const checksum = [...header].reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
    assert.equal(checksum, number(148, 8), 'Invalid tar header checksum');
    const size = number(124, 12);
    const prefix = field(header, 345, 155);
    const name = `${prefix ? `${prefix}/` : ''}${field(header, 0, 100)}`;
    const type = field(header, 156, 1);
    assert(offset + 512 + size <= tar.length, 'Truncated archive member');
    const relative = name.startsWith(`${lock.upstream.archivePrefix}/`) ? name.slice(lock.upstream.archivePrefix.length + 1) : null;
    if (relative && expected.has(relative)) {
      assert(type === '0' || type === '', `Source is not a regular file: ${relative}`);
      assert(!files.has(relative), `Duplicate archive member: ${relative}`);
      const bytes = Buffer.from(tar.subarray(offset + 512, offset + 512 + size));
      verify(bytes, expected.get(relative));
      const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      assert.equal(blob, expected.get(relative).gitBlobSha1, `Unexpected Git blob: ${relative}`);
      files.set(relative, bytes);
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert.equal(files.size, expected.size, 'Missing locked source inputs');
  return files;
}

/** Apply generated unified diffs exactly: no offsets, fuzz, subprocesses, or filesystem paths. */
export function applySourcePatch(files, patch) {
  const lines = patch.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
  let index = 0;
  while (index < lines.length) {
    const before = lines[index++];
    assert(before.startsWith('--- '), 'Expected patch source');
    const after = lines[index++];
    assert(after?.startsWith('+++ b/'), 'Expected patch destination');
    const file = safePath(after.slice(6).trimEnd());
    const isNew = before === '--- /dev/null\n';
    assert(isNew || before === `--- a/${file}\n`, 'Patch cannot rename source files');
    assert.equal(files.has(file), !isNew, `Unexpected patch source: ${file}`);
    const source = (files.get(file)?.toString('utf8') ?? '').match(/[^\n]*\n|[^\n]+$/gu) ?? [];
    const result = [];
    let cursor = 0;
    while (index < lines.length && lines[index].startsWith('@@ ')) {
      const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@\n$/u.exec(lines[index++]);
      assert(hunk, 'Unsupported patch hunk');
      const start = Number(hunk[1]) === 0 ? 0 : Number(hunk[1]) - 1;
      assert(start >= cursor && start <= source.length, 'Overlapping patch hunk');
      result.push(...source.slice(cursor, start));
      cursor = start;
      assert.equal(result.length, Number(hunk[3]) === 0 ? 0 : Number(hunk[3]) - 1, 'Patch destination offset differs');
      let removed = 0;
      let added = 0;
      while (removed < Number(hunk[2] ?? 1) || added < Number(hunk[4] ?? 1)) {
        const line = lines[index++];
        assert(line && /^[ +\-]/u.test(line), 'Truncated patch hunk');
        if (line[0] !== '+') {
          assert.equal(source[cursor++], line.slice(1), `Patch context differs: ${file}`);
          removed++;
        }
        if (line[0] !== '-') { result.push(line.slice(1)); added++; }
      }
      assert.equal(removed, Number(hunk[2] ?? 1), 'Patch source span differs');
      assert.equal(added, Number(hunk[4] ?? 1), 'Patch destination span differs');
    }
    result.push(...source.slice(cursor));
    files.set(file, Buffer.from(result.join('')));
  }
}

async function prepareSourceFiles(archive, lock, scriptsRoot) {
  const files = readSourceArchive(archive, lock);
  for (const patch of lock.patches) {
    const bytes = await readFile(path.join(scriptsRoot, safePath(patch.path)));
    verify(bytes, patch);
    applySourcePatch(files, bytes.toString('utf8'));
  }
  assert.equal(files.size, lock.prepared.length, 'Unexpected prepared file count');
  for (const expected of lock.prepared) {
    const bytes = files.get(safePath(expected.path));
    assert(bytes, `Missing prepared file: ${expected.path}`);
    verify(bytes, expected);
  }
  return files;
}

async function acquireArchive(lock, archivePath) {
  if (archivePath) {
    assert.equal((await stat(archivePath)).size, lock.upstream.archiveBytes, 'Unexpected archive length');
    const bytes = await readFile(archivePath);
    assert.equal(bytes.length, lock.upstream.archiveBytes, 'Unexpected archive length');
    return bytes;
  }
  const response = await fetch(lock.upstream.archiveUrl, { signal: AbortSignal.timeout(120_000) });
  assert(response.ok && response.body, `Source download failed (${response.status})`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert(size <= lock.upstream.archiveBytes, 'Source download exceeds locked length');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Explicit maintainer builds alone call this; published packages contain the complete engine. */
export async function withPreparedSource(lock, scriptsRoot, callback, archivePath = process.env.LYRA_DOCX_SOURCE_ARCHIVE) {
  const files = await prepareSourceFiles(await acquireArchive(lock, archivePath), lock, scriptsRoot);
  const directory = await mkdtemp(path.join(tmpdir(), 'lyra-docx-engine-'));
  try {
    for (const [file, bytes] of files) {
      const destination = path.join(directory, file);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, bytes, { flag: 'wx' });
    }
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
