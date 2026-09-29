import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertRegularSourcePath, commitSourceWritePlan, parseSourceJson, readSourceSnapshot } from './source-fixture-io.mjs';

test('strict source JSON rejects escaped duplicate keys while preserving distinct nested keys', () => {
  assert.throws(() => parseSourceJson('{"key":1,"k\\u0065y":2}', 'fixture'), /duplicate JSON key key/);
  assert.throws(() => parseSourceJson('{"nested":[{"x":1,"x":2}]}', 'fixture'), /duplicate JSON key x/);
  assert.throws(() => parseSourceJson('{"key":1,}', 'fixture'), SyntaxError);
  assert.deepEqual(parseSourceJson('{"left":{"x":1},"right":{"x":2},"value":"}\\\""}', 'fixture'), {
    left: { x: 1 }, right: { x: 2 }, value: '}"',
  });
});

test('source paths reject escapes, symlinked roots and missing ancestors', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'source-io-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'root');
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'file'), 'original');
  fs.symlinkSync(root, path.join(directory, 'alias'));
  assert.throws(() => assertRegularSourcePath(root, path.join(directory, 'outside')), /escapes/);
  assert.throws(() => assertRegularSourcePath(path.join(directory, 'alias'), path.join(directory, 'alias/file')), /symlink/);
  assert.throws(() => assertRegularSourcePath(root, path.join(root, 'absent/file'), { missing: true }), /ENOENT/);
  fs.symlinkSync(path.join(root, 'absent'), path.join(root, 'dangling'));
  assert.throws(() => readSourceSnapshot(root, 'dangling', { missing: true }), /symlink|regular/);
  assert.deepEqual(readSourceSnapshot(root, 'new', { missing: true }), { file: path.join(root, 'new'), original: null });
});

test('a source write plan preserves permissions and refuses duplicate or conflicting paths', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-write-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'source.json');
  fs.writeFileSync(file, '{}\n', { mode: 0o640 });
  const entry = { ...readSourceSnapshot(root, 'source.json'), expected: '{"next":true}\n' };
  assert.throws(() => commitSourceWritePlan({ root, entries: [entry, entry] }), /Duplicate/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{}\n');
  commitSourceWritePlan({ root, entries: [entry] });
  assert.equal(fs.statSync(file).mode & 0o777, 0o640);
  assert.equal(fs.readFileSync(file, 'utf8'), entry.expected);
  assert.throws(() => commitSourceWritePlan({ root, entries: [entry] }), /changed while/);
});

for (const replacement of ['deleted', 'symlink']) {
  test(`rollback restores other files after a concurrent destination is ${replacement}`, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'source-rollback-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const files = ['a', 'b', 'c'].map(name => path.join(root, name));
    for (const file of files) fs.writeFileSync(file, 'original');
    const outside = path.join(root, 'independent');
    fs.writeFileSync(outside, 'independent original');
    const entries = files.map(file => ({ file, original: 'original', expected: 'changed' }));
    const rename = fs.renameSync;
    let count = 0;
    fs.renameSync = (...args) => {
      if (++count === 3) {
        fs.unlinkSync(files[1]);
        if (replacement === 'symlink') fs.symlinkSync(outside, files[1]);
        throw new Error('simulated third replacement failure');
      }
      return rename(...args);
    };
    try { assert.throws(() => commitSourceWritePlan({ root, entries }), /failure/); }
    finally { fs.renameSync = rename; }
    assert.equal(fs.readFileSync(files[0], 'utf8'), 'original');
    assert.equal(fs.readFileSync(files[2], 'utf8'), 'original');
    assert.equal(fs.readFileSync(outside, 'utf8'), 'independent original');
    if (replacement === 'deleted') assert.equal(fs.existsSync(files[1]), false);
    else assert.equal(fs.lstatSync(files[1]).isSymbolicLink(), true);
    assert.equal(fs.readdirSync(root).some(name => name.includes('.source-')), false);
  });
}
