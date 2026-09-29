import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { capturePolicyWitnesses } from './capture-published-policy-witnesses.mjs';
import { capturePublishedCompatibility } from './capture-published-compatibility.mjs';
import { readPublishedCapture, sha256, jsonBytes, SOURCE_INPUTS } from './published-compatibility-io.mjs';
import { emptyRenameLedger, projectRenameLedger } from './lyra-rename-ledger.mjs';

test('explicit capture verifies immutable inputs before writing and refuses replacement of a capture', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-capture-'));
  try {
    const repository = join(root, 'source'); mkdirSync(repository);
    const git = args => execFileSync('git', ['-C', repository, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git(['init', '-q']);
    const packageJson = { name: '@aceshooting/lyra-ui', version: '22.0.0', exports: {} };
    const manifest = { schemaVersion: '1.0.0', modules: [] };
    const source = { packageJson, manifest, metadata: { schemaVersion: 2, history: { current: { version: '22.0.0' } }, deprecations: [], exportDeprecations: [] },
      inventory: { schemaVersion: 1, pins: { lyraVersion: '22.0.0' }, components: [], mappings: [], upstreams: {} }, renameLedger: emptyRenameLedger() };
    const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, jsonBytes(value)); };
    for (const [key, path] of Object.entries(SOURCE_INPUTS)) write(join(repository, 'packages/lyra-ui', path), source[key]);
    git(['add', '.']); git(['commit', '-qm', 'published fixture']); git(['tag', '-a', 'lyra-ui@22.0.0', '-m', 'release']);
    const packed = join(root, 'packed');
    write(join(packed, 'package/package.json'), packageJson);
    write(join(packed, 'package/custom-elements.json'), manifest);
    write(join(packed, 'package/dist/cli/migration-contract.json'), { lyraRenames: projectRenameLedger(source.renameLedger, source.inventory) });
    const tarball = join(root, 'published.tgz'); execFileSync('tar', ['-czf', tarball, '-C', packed, 'package']);
    const bytes = readFileSync(tarball);
    const options = { repository, tag: 'lyra-ui@22.0.0', commit: git(['rev-parse', 'HEAD']), tagObject: git(['rev-parse', 'lyra-ui@22.0.0']),
      tarball, tarballSha256: sha256(bytes), registryIntegrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`, output: join(root, 'capture') };
    assert.throws(() => capturePublishedCompatibility({ ...options, tarballSha256: '0'.repeat(64) }), /integrity mismatch/u);
    assert.equal(existsSync(options.output), false);
    capturePublishedCompatibility(options);
    assert.equal((await readPublishedCapture(options.output)).capture.git.commit, options.commit);
    assert.throws(() => capturePublishedCompatibility(options), /already exists/u);
    assert.throws(() => capturePublishedCompatibility({ ...options, output: join(root, 'bad-tag'), tag: 'lyra-ui@23.0.0' }), /identity mismatch|bind the pinned release/u);
    assert.equal(existsSync(join(root, 'bad-tag')), false);
    const witness = { repository, facts: { policyReleaseHistory: [{ tag: options.tag, version: '22.0.0', sourceCommit: options.commit }] },
      tagObjects: { [options.tag]: options.tagObject }, output: join(root, 'witness.json.gz') };
    assert.ok(capturePolicyWitnesses(witness).bytes > 0);
    assert.throws(() => capturePolicyWitnesses(witness), /EEXIST/u);
    assert.throws(() => capturePolicyWitnesses({ ...witness, tagObjects: { [options.tag]: options.commit }, output: join(root, 'invalid-witness') }));
    assert.equal(existsSync(join(root, 'invalid-witness')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
