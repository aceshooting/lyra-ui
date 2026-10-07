import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeEvidence, decodeEvidence, gitObjectId, verifyGitEvidence, readPublishedCaptureSync } from './published-compatibility-io.mjs';
import { validateRenameLedgerShape } from './lyra-rename-ledger.mjs';

const bytes = value => Buffer.from(value);
function proof() {
  const blob = bytes('exact published bytes\n');
  const blobId = gitObjectId('blob', blob);
  const tree = Buffer.concat([bytes('100644 package.json\0'), Buffer.from(blobId, 'hex')]);
  const treeId = gitObjectId('tree', tree);
  const commit = bytes(`tree ${treeId}\nauthor Test <test@example.invalid> 0 +0000\ncommitter Test <test@example.invalid> 0 +0000\n\nrelease\n`);
  const commitId = gitObjectId('commit', commit);
  const tag = bytes(`object ${commitId}\ntype commit\ntag lyra-ui@22.0.0\ntagger Test <test@example.invalid> 0 +0000\n\nrelease\n`);
  return { pin: { commit: commitId, tagObject: gitObjectId('tag', tag), tag: 'lyra-ui@22.0.0' },
    objects: [{ type: 'tree', oid: treeId, data: tree.toString('base64') }, { type: 'commit', oid: commitId, data: commit.toString('base64') }, { type: 'tag', oid: gitObjectId('tag', tag), data: tag.toString('base64') }],
    inputs: [{ path: 'package.json', gitBlob: blobId, data: blob.toString('base64') }] };
}

test('bounded deterministic evidence round-trips exact bytes, never filesystem paths', () => {
  const value = { schemaVersion: 1, payloads: { abc: bytes('unicode é\r\n').toString('base64') } };
  const encoded = encodeEvidence(value);
  assert.deepEqual(encoded, encodeEvidence(value));
  assert.deepEqual(decodeEvidence(encoded), value);
  assert.throws(() => decodeEvidence(gzipSync(Buffer.alloc(1024)), 100), /limit|large|length|size/u);
  assert.throws(() => decodeEvidence(bytes('not gzip')));
});

test('Git proof binds exact blob path through tree and commit to annotated release tag', () => {
  const fixture = proof();
  assert.equal(verifyGitEvidence(fixture), true);
  for (const mutate of [
    x => { x.inputs[0].path = 'other.json'; },
    x => { x.inputs[0].data = bytes('modified').toString('base64'); },
    x => { x.pin.commit = '0'.repeat(40); },
    x => { x.pin.tag = 'lyra-ui@23.0.0'; },
    x => { x.objects.push(structuredClone(x.objects[0])); },
    x => { x.inputs[0].path = '../package.json'; },
    x => { x.objects[0].data = bytes('malformed tree').toString('base64'); },
  ]) { const input = structuredClone(fixture); mutate(input); assert.throws(() => verifyGitEvidence(input)); }
});

test('Git object hashing includes the type and byte length', () => {
  assert.equal(gitObjectId('blob', bytes('hello\n')), createHash('sha1').update('blob 6\0hello\n').digest('hex'));
  assert.notEqual(gitObjectId('blob', bytes('hello\n')), gitObjectId('tree', bytes('hello\n')));
});

test('large Git blobs retain exact bytes without regular-expression stack exhaustion', () => {
  const fixture = proof();
  const data = bytes('x'.repeat(8 * 1024 * 1024));
  fixture.inputs[0].data = data.toString('base64');
  assert.throws(() => verifyGitEvidence(fixture), /source bytes disagree/u);
});

test('the published manifest projection shares one verified capture read and remains detached', () => {
  const directory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/compatibility-history/22.0.0');
  const reads = new Map();
  const readBytes = file => {
    reads.set(file, (reads.get(file) ?? 0) + 1);
    return readFileSync(file);
  };
  const verified = readPublishedCaptureSync(directory, { readBytes });
  assert.equal(reads.size, 3);
  assert.ok([...reads.values()].every(count => count === 1));
  const archive = decodeEvidence(readFileSync(join(directory, 'evidence.json.gz')));
  const input = verified.capture.inputs.find(entry => entry.origin === 'source' && entry.role === 'manifest');
  const manifest = JSON.parse(Buffer.from(archive.payloads[input.sha256], 'base64').toString('utf8'));
  assert.deepEqual(verified.publishedManifest, manifest);
  const facts = JSON.stringify(verified.facts);
  verified.publishedManifest.modules.length = 0;
  assert.equal(JSON.stringify(verified.facts), facts);
  assert.deepEqual(readPublishedCaptureSync(directory).publishedManifest, manifest);
});

test('historical published profiles remain bound to their release while current ledgers require every profile', () => {
  const directory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/compatibility-history/22.0.0');
  const verified = readPublishedCaptureSync(directory);
  assert.deepEqual(verified.publishedMigration.lyraRenames.profiles.map(profile => profile.origin), ['lyra-v21', 'lyra-v22']);
  assert.deepEqual(validateRenameLedgerShape(verified.publishedMigration.lyraRenames, {
    projected: true, historicalReleaseMajor: 22,
  }), []);
  assert.deepEqual(validateRenameLedgerShape(verified.publishedMigration.lyraRenames, {
    projected: true, historicalReleaseMajor: 25,
  }), []);
  assert.match(validateRenameLedgerShape(verified.publishedMigration.lyraRenames, {
    projected: true, historicalReleaseMajor: 26,
  }).join('; '), /lyra-v25/u);
  assert.match(validateRenameLedgerShape(verified.publishedMigration.lyraRenames, { projected: true }).join('; '), /lyra-v25/u);
});
