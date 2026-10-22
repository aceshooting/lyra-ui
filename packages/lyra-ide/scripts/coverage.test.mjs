import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { sourceInventory } from '../../lyra-docs/scripts/lib/node-coverage.mjs';
import { stageScripts } from '../../lyra-docs/scripts/lib/staged-script.mjs';
import { ROOT, SCOPE } from './coverage.mjs';

test('every JavaScript file of the package is either measured or excluded for a stated reason', async () => {
  const { included, excluded } = await sourceInventory({ root: ROOT, include: SCOPE.include, exclude: SCOPE.exclude });
  assert.deepEqual(included.map(entry => entry.name), ['scripts/check-package.mjs', 'scripts/coverage.mjs', 'scripts/sync.mjs']);
  assert.deepEqual(excluded.map(({ reason, sample }) => ({ reason, sample })), [{
    reason: 'test',
    sample: ['scripts/check-package.test.mjs', 'scripts/coverage.test.mjs', 'scripts/package.test.mjs'],
  }]);
});

test('a script nobody classified would stop the measurement', async () => {
  await assert.rejects(sourceInventory({ root: ROOT, include: ['scripts/sync.mjs'], exclude: SCOPE.exclude }),
    /Unclassified JavaScript source: scripts\/check-package\.mjs/u);
});

test('the floor is a percentage the package can meet', () => {
  assert.ok(Number.isFinite(SCOPE.floor) && SCOPE.floor > 0 && SCOPE.floor <= 100);
});

/** The runner staged beside the real measurement engine, with a package whose own test covers little. */
function stagedRunner(context, partialTest) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-ide-runner-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const own = join(root, 'packages', 'lyra-ide');
  mkdirSync(join(root, 'packages'));
  symlinkSync(join(ROOT, '..', 'lyra-docs'), join(root, 'packages', 'lyra-docs'), 'junction');
  const staged = stageScripts({ from: ROOT, to: own, files: SCOPE.include });
  writeFileSync(join(own, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { test: 'node --test scripts/partial.test.mjs' } }));
  writeFileSync(join(own, 'scripts/partial.test.mjs'), partialTest);
  return { own, run: () => spawnSync(process.execPath, [staged[SCOPE.include.indexOf('scripts/coverage.mjs')]], { encoding: 'utf8' }) };
}

const PARTIAL = `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { IDE_DATA_FILES } from './sync.mjs';\ntest('lists four files', () => assert.equal(IDE_DATA_FILES.length, 4));\n`;

test('the command line measures its own package and fails the run when the floor is missed', context => {
  const { own, run } = stagedRunner(context, PARTIAL);
  const result = run();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /@aceshooting\/lyra-ide coverage - lines \d+(?:\.\d+)?% \(\d+\/\d+\)/u);
  assert.match(result.stderr, /lines coverage \d+\.\d{3}% is below 95%/u);
  const metadata = JSON.parse(readFileSync(join(own, 'coverage/coverage-metadata.json'), 'utf8'));
  assert.equal(metadata.package, '@aceshooting/lyra-ide');
  assert.equal(metadata.complete, true);
  assert.deepEqual(metadata.included, SCOPE.include);
  assert.deepEqual(metadata.unloaded, ['scripts/check-package.mjs', 'scripts/coverage.mjs']);
});
