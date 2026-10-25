import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { sourceInventory } from '../../../scripts/lib/coverage/node-coverage.mjs';
import { stageScripts } from '../../../scripts/lib/coverage/staged-script.mjs';
import { ROOT, SCOPE } from './coverage.mjs';

const ASSEMBLED = 'assembled output of scripts/build.mjs: catalogs generated from lyra-ui';

test('every JavaScript file of the package is either measured or excluded for a stated reason', async () => {
  const { included, excluded } = await sourceInventory({ root: ROOT, include: SCOPE.include, exclude: SCOPE.exclude });
  assert.deepEqual(included.map(entry => entry.name), ['scripts/build.mjs', 'scripts/check-package.mjs', 'scripts/coverage.mjs']);
  // The assembled tree exists only after `assemble`, so it may or may not be present here.
  assert.deepEqual(excluded.map(({ reason }) => reason).filter(reason => reason !== ASSEMBLED), ['test']);
  assert.equal(excluded.find(({ reason }) => reason === 'test').count, 3);
});

test('the assembled tree is excluded wholesale and a script outside it is not', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-translations-scope-'));
  try {
    for (const file of ['scripts/build.mjs', 'scripts/check-package.mjs', 'scripts/coverage.mjs', 'scripts/package.test.mjs',
      'dist/fr.js', 'dist/de-CH/forms.js', 'dist/pseudo/ar-XB.js']) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), 'export {};\n');
    }
    const { included, excluded } = await sourceInventory({ root, include: SCOPE.include, exclude: SCOPE.exclude });
    assert.deepEqual(included.map(entry => entry.name), SCOPE.include);
    assert.deepEqual(excluded.map(({ reason, count }) => ({ reason, count })), [{ reason: ASSEMBLED, count: 3 }, { reason: 'test', count: 1 }]);

    mkdirSync(join(root, 'scripts/dist'));
    writeFileSync(join(root, 'scripts/dist/build.js'), 'export {};\n');
    await assert.rejects(sourceInventory({ root, include: SCOPE.include, exclude: SCOPE.exclude }),
      /Unclassified JavaScript source: scripts\/dist\/build\.js/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a script nobody classified would stop the measurement', async () => {
  await assert.rejects(sourceInventory({ root: ROOT, include: ['scripts/build.mjs'], exclude: SCOPE.exclude }),
    /Unclassified JavaScript source: scripts\/check-package\.mjs/u);
});

test('the floor is a percentage the package can meet', () => {
  assert.ok(Number.isFinite(SCOPE.floor) && SCOPE.floor > 0 && SCOPE.floor <= 100);
});

/** The runner staged beside the real measurement engine, with a package whose own test covers little. */
function stagedRunner(context) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-translations-runner-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const own = join(root, 'packages', 'lyra-translations');
  mkdirSync(join(root, 'packages'));
  symlinkSync(join(ROOT, '../..', 'scripts'), join(root, 'scripts'), 'junction');
  stageScripts({ from: join(ROOT, '..', 'lyra-ui'), to: join(root, 'packages', 'lyra-ui'), files: ['scripts/translations-companion.mjs'] });
  const staged = stageScripts({ from: ROOT, to: own, files: SCOPE.include });
  writeFileSync(join(own, 'package.json'), JSON.stringify({ name: 'fixture', scripts: { test: 'node --test scripts/partial.test.mjs' } }));
  writeFileSync(join(own, 'scripts/partial.test.mjs'),
    `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { buildTranslations } from './build.mjs';\ntest('exports the assembler', () => assert.equal(typeof buildTranslations, 'function'));\n`);
  return { own, run: () => spawnSync(process.execPath, [staged[SCOPE.include.indexOf('scripts/coverage.mjs')]], { encoding: 'utf8' }) };
}

test('the command line measures its own package and fails the run when the floor is missed', context => {
  const { own, run } = stagedRunner(context);
  const result = run();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /@aceshooting\/lyra-translations coverage - lines \d+(?:\.\d+)?% \(\d+\/\d+\)/u);
  assert.match(result.stderr, new RegExp(`lines coverage \\d+\\.\\d{3}% is below ${SCOPE.floor}%`, 'u'));
  const metadata = JSON.parse(readFileSync(join(own, 'coverage/coverage-metadata.json'), 'utf8'));
  assert.equal(metadata.package, '@aceshooting/lyra-translations');
  assert.equal(metadata.complete, true);
  assert.deepEqual(metadata.included, SCOPE.include);
  assert.deepEqual(metadata.unloaded, ['scripts/check-package.mjs', 'scripts/coverage.mjs']);
});
