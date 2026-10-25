import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { stageScripts } from '../../../scripts/lib/coverage/staged-script.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');

// The shared source policies live in the core package; the package check only counts and compares their findings,
// so a fixture supplies a policy whose findings the test dictates through the environment.
const POLICY = `import path from 'node:path';
export function collectSourcePolicyFindings({ file }) {
  return JSON.parse(process.env.FIXTURE_POLICY ?? '{}')[path.basename(file)] ?? [];
}
export const findDoubleQuotedStringLiterals = () => [];
export const findNulByteLines = () => [];
export const findBareGlobalIsNaNCalls = () => [];
`;

/** A repository skeleton holding the package files the check reads, with a policy-less core package and no build output. */
async function repository(context) {
  const root = realpathSync(await mkdtemp(resolve(tmpdir(), 'lyra-docs-package-')));
  context.after(() => rm(root, { recursive: true, force: true }));
  const docs = resolve(root, 'packages/lyra-docs');
  stageScripts({ from: packageRoot, to: docs, files: [
    'scripts/check-package.mjs', 'scripts/lib/static-files.mjs', 'scripts/lib/editor-tags.mjs', 'scripts/lib/engine-imports.mjs',
  ] });
  mkdirSync(resolve(root, '.changeset'), { recursive: true });
  cpSync(resolve(repositoryRoot, 'package.json'), resolve(root, 'package.json'));
  cpSync(resolve(repositoryRoot, '.changeset/config.json'), resolve(root, '.changeset/config.json'));
  for (const file of ['package.json', 'README.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md']) cpSync(resolve(packageRoot, file), resolve(docs, file));
  cpSync(resolve(packageRoot, 'THIRD_PARTY_LICENSES'), resolve(docs, 'THIRD_PARTY_LICENSES'), { recursive: true });
  mkdirSync(resolve(docs, 'src/docx'), { recursive: true });
  for (const file of ['strings.ts', 'docx-editor.class.ts', 'editor.ts']) cpSync(resolve(packageRoot, 'src/docx', file), resolve(docs, 'src/docx', file));
  for (const file of ['docx-editor.styles.ts', 'extra.ts']) writeFileSync(resolve(docs, 'src/docx', file), 'export {};\n');
  await symlink(resolve(packageRoot, 'node_modules'), resolve(docs, 'node_modules'));
  const core = resolve(root, 'packages/lyra-ui');
  mkdirSync(resolve(core, 'src'), { recursive: true });
  mkdirSync(resolve(core, 'scripts'), { recursive: true });
  writeFileSync(resolve(core, 'package.json'), JSON.stringify({ name: '@aceshooting/lyra-ui', version: '0.0.0' }));
  writeFileSync(resolve(core, 'src/index.ts'), 'export {};\n');
  writeFileSync(resolve(core, 'scripts/check-source-policy.mjs'), POLICY);
  writeFileSync(resolve(core, 'scripts/module-specifiers.mjs'), 'export const staticModuleSpecifiers = () => [];\n');
  writeFileSync(resolve(core, 'scripts/check-build-artifacts.mjs'), 'export const findBuildArtifactFindings = () => [];\n');
  return { root, check: resolve(docs, 'scripts/check-package.mjs') };
}

function check({ root, check: script }, { policy = {}, ci = false } = {}) {
  const env = { ...process.env, FIXTURE_POLICY: JSON.stringify(policy) };
  if (ci) env['CI'] = 'true'; else delete env['CI'];
  return spawnSync(process.execPath, [realpathSync(script)], { cwd: root, encoding: 'utf8', env });
}

const finding = (file, rule = 'physical-css') => `${file}:1 [${rule}] a finding`;
const BASELINED = 'docx-editor.styles.ts';

test('without a build, the package contract is checked up to the emitted files and says what it skipped', async context => {
  const result = check(await repository(context));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /WARNING: dist\/ is missing; the emitted-package checks did not run\./u);
  assert.match(result.stdout, /Document companion public\/export\/dependency checks passed/u);
});

test('under CI a missing build is a failure, not a warning', async context => {
  const result = check(await repository(context), { ci: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /dist\/ is missing: build @aceshooting\/lyra-docs before its package checks/u);
  assert.doesNotMatch(result.stdout, /checks passed/u);
});

test('findings that stay within the reviewed baseline pass silently', async context => {
  const result = check(await repository(context), { policy: { [BASELINED]: Array.from({ length: 9 }, () => finding(BASELINED)) } });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /baseline can be lowered/u);
});

test('findings below the reviewed baseline are reported so the baseline can be lowered', async context => {
  const repo = await repository(context);
  for (const [count, expected] of [[3, '9 -> 3'], [0, '9 -> 0']]) {
    const result = check(repo, { policy: { [BASELINED]: Array.from({ length: count }, () => finding(BASELINED)) } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, new RegExp(`Source policy baseline can be lowered: src/docx/docx-editor\\.styles\\.ts \\[physical-css\\] ${expected}`, 'u'));
  }
});

test('findings beyond the reviewed baseline fail the check and are listed', async context => {
  const repo = await repository(context);
  const cases = [
    ['more findings than the baselined file may have', { [BASELINED]: Array.from({ length: 10 }, () => finding(BASELINED)) }, finding(BASELINED)],
    ['a finding in a file that has no baseline', { 'extra.ts': [finding('extra.ts')] }, finding('extra.ts')],
    ['a finding of another rule in a baselined file', { [BASELINED]: [finding(BASELINED, 'literal-tag-name')] }, finding(BASELINED, 'literal-tag-name')],
  ];
  for (const [name, policy, listed] of cases) {
    const result = check(repo, { policy });
    assert.notEqual(result.status, 0, name);
    assert.match(result.stderr, /Shared source policy findings beyond the reviewed baseline/u, name);
    assert.ok(result.stderr.includes(listed), `${name}: the finding is listed`);
  }
});

test('a finding that names no rule is counted under an unknown rule instead of being dropped', async context => {
  const result = check(await repository(context), { policy: { 'extra.ts': ['extra.ts:1 a finding without a rule tag'] } });
  assert.notEqual(result.status, 0);
  assert.ok(result.stderr.includes('src/docx/extra.ts [unknown]'), result.stderr);
});
