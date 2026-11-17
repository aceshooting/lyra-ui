import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { prepareBrowserOutputPaths, resolveBrowserOutputPaths } from './lib/browser-output.mjs';

async function fixture(context) {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-browser-output-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const repositoryRoot = join(directory, 'repo');
  const packageRoot = join(repositoryRoot, 'packages/lyra-docs');
  await mkdir(packageRoot, { recursive: true });
  return { directory, repositoryRoot, packageRoot };
}

test('unset output selection preserves the existing bundle and mandatory screenshot destinations', async context => {
  const options = await fixture(context);
  const paths = await prepareBrowserOutputPaths({ ...options, environment: {} });
  assert.equal(paths.isolated, false);
  assert.equal(paths.outputDirectory, join(options.packageRoot, '.browser-output'));
  assert.equal(paths.evidenceDirectory, join(options.packageRoot, '.browser-evidence'));
});

test('independent invocations retain their own bundle, receipts and screenshots without touching default output', async context => {
  const options = await fixture(context);
  const defaultOutput = join(options.packageRoot, '.browser-output');
  await mkdir(defaultOutput);
  await writeFile(join(defaultOutput, 'sentinel'), 'default');
  const paths = await Promise.all(['firefox', 'webkit'].map(name => prepareBrowserOutputPaths({
    ...options, environment: { DOCX_BROWSER_RUN_DIR: join(options.directory, name) },
  })));
  for (const [index, path] of paths.entries()) {
    assert.equal(path.isolated, true);
    await writeFile(join(path.outputDirectory, 'browser-evidence.json'), String(index));
    await writeFile(join(path.evidenceDirectory, 'layout.png'), String(index));
  }
  await rm(paths[0].outputDirectory, { recursive: true });
  assert.equal(await readFile(join(paths[1].outputDirectory, 'browser-evidence.json'), 'utf8'), '1');
  assert.equal(await readFile(join(paths[1].evidenceDirectory, 'layout.png'), 'utf8'), '1');
  assert.equal(await readFile(join(defaultOutput, 'sentinel'), 'utf8'), 'default');
});

test('racing claims have exactly one owner and a rejected claimant cannot erase evidence', async context => {
  const options = await fixture(context);
  const environment = { DOCX_BROWSER_RUN_DIR: join(options.directory, 'shared') };
  const outcomes = await Promise.allSettled([0, 1].map(() => prepareBrowserOutputPaths({ ...options, environment })));
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  const winner = outcomes.find(outcome => outcome.status === 'fulfilled').value;
  await writeFile(join(winner.outputDirectory, 'receipt'), 'owned');
  await assert.rejects(prepareBrowserOutputPaths({ ...options, environment }));
  assert.equal(await readFile(join(winner.outputDirectory, 'receipt'), 'utf8'), 'owned');
});

test('invalid or preexisting destinations and coverage fail before claiming a directory', async context => {
  const options = await fixture(context);
  const existing = join(options.directory, 'existing');
  const file = join(options.directory, 'file');
  const link = join(options.directory, 'link');
  await mkdir(existing); await writeFile(file, 'preserve'); await symlink(existing, link);
  for (const target of ['', 'relative', options.repositoryRoot, join(options.repositoryRoot, 'generated'), existing, file, link, join(options.directory, 'missing/child')]) {
    await assert.rejects(prepareBrowserOutputPaths({ ...options, environment: { DOCX_BROWSER_RUN_DIR: target } }), undefined, target);
  }
  const target = join(options.directory, 'coverage');
  assert.throws(() => resolveBrowserOutputPaths({ ...options, environment: { DOCX_BROWSER_RUN_DIR: target, DOCX_COVERAGE: '1' } }), /coverage/iu);
  await assert.rejects(readFile(target), { code: 'ENOENT' });
  assert.equal(await readFile(file, 'utf8'), 'preserve');
});

test('canonical parents prevent checkout aliases while prefix neighbors and owned screenshots remain valid', async context => {
  const options = await fixture(context);
  const alias = join(options.directory, 'alias');
  await symlink(options.repositoryRoot, alias);
  await assert.rejects(prepareBrowserOutputPaths({ ...options, environment: { DOCX_BROWSER_RUN_DIR: join(alias, 'child') } }), /checkout/iu);
  const root = join(options.directory, 'repo-neighbor');
  const environment = { DOCX_BROWSER_RUN_DIR: root, DOCX_SCREENSHOTS: join(root, 'evidence') };
  const paths = await prepareBrowserOutputPaths({ ...options, environment });
  assert.equal(paths.evidenceDirectory, join(root, 'evidence'));
  assert.throws(() => resolveBrowserOutputPaths({ ...options, environment: { DOCX_BROWSER_RUN_DIR: join(options.directory, 'another'), DOCX_SCREENSHOTS: join(options.directory, 'other-screenshots') } }), /DOCX_SCREENSHOTS/u);
});
