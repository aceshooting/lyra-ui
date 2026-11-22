import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32, deflateRawSync } from 'node:zlib';
import { compareSkillArchives, zipEntryDigests } from './check-skill-bundles.mjs';

function zip(files, { level = 9, stored = false } = {}) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text);
    const body = stored ? data : deflateRawSync(data, { level });
    const nameBuffer = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, body);
    centrals.push(central, nameBuffer);
    offset += 30 + nameBuffer.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const files = [['b/two.md', 'two '.repeat(500)], ['a/one.md', 'one']];

test('archives that differ only in compression compare equal', () => {
  const fast = zip(files, { level: 1 });
  const best = zip(files, { level: 9 });
  assert.notDeepEqual(fast, best);
  assert.deepEqual(compareSkillArchives(fast, best), []);
  assert.deepEqual(compareSkillArchives(fast, zip(files, { stored: true })), []);
});

test('entry order does not matter and names come back sorted', () => {
  const reversed = zip([...files].reverse());
  assert.deepEqual(zipEntryDigests(reversed).map((entry) => entry.name), ['a/one.md', 'b/two.md']);
  assert.deepEqual(compareSkillArchives(zip(files), reversed), []);
});

test('changed, missing and extra entries are reported', () => {
  const changed = zip([['a/one.md', 'ONE'], ['b/two.md', 'two '.repeat(500)]]);
  assert.deepEqual(compareSkillArchives(zip(files), changed), ['content differs: a/one.md']);
  const fewer = zip([files[0]]);
  assert.deepEqual(compareSkillArchives(zip(files), fewer), ['missing from the rebuilt archive: a/one.md']);
  assert.deepEqual(compareSkillArchives(fewer, zip(files)), ['not in the committed archive: a/one.md']);
});

test('a non-zip buffer is rejected', () => {
  assert.throws(() => zipEntryDigests(Buffer.from('not a zip')), /not a zip archive/);
});
