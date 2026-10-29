import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createNativeTerrainInputsFixture } from './native-terrain-inputs-fixture.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const sourceTreeSha256 = '0653c9c9880d6584333721595eb7e3ca39b581132c91b75648a3b08b49acd107';
const scripts = ['build', 'complete-transform', 'base-transform', 'worker-transform', 'metadata-transform',
  'sprite-key-transform', 'prepared-mutations', 'feature-requirements', 'preparation-runtime',
  'code-serialization', 'native-terrain-contract'];
const sceneModules = ['index', 'bridge', 'bridge-glyph', 'frame', 'geographic', 'geometry-chart', 'gl-state',
  'lifetime', 'native-terrain-authority', 'projection', 'resource-ledger', 'terrain-native', 'terrain-points'];
const patches = ['@codecov__bundler-plugin-core@2.0.1.patch', '@web__test-runner-coverage-v8@1.0.0.patch',
  'braces@3.0.3.patch', 'deepmerge@4.1.1.patch', 'sprintf-js@1.0.3.patch'];
const exists = file => access(file).then(() => true, () => false);
let collector;
async function capture(fixture, changes = {}) {
  collector ??= import('../scripts/native-terrain-contract.mjs');
  const { captureNativeTerrainBuildInputs } = await collector;
  assert.equal(typeof captureNativeTerrainBuildInputs, 'function');
  return captureNativeTerrainBuildInputs({ packageRoot: fixture.directory,
    verifiedSourceTreeSha256: sourceTreeSha256, compilerOptions: fixture.compilerOptions, ...changes });
}
async function fixtureFor(context) {
  const fixture = await createNativeTerrainInputsFixture();
  context.after(() => fixture.remove());
  return fixture;
}
function captured(value) {
  assert.equal(value.status, 'captured');
  assert.equal(value.sourceTreeSha256, sourceTreeSha256);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.records), true);
  assert.equal(Object.hasOwn(value, 'enabled'), false, 'input capture is not specialization admission');
  assert.equal(Object.hasOwn(value, 'authority'), false, 'input capture issues no terrain authority');
  const names = value.records.map(record => record.file);
  assert.deepEqual(names, [...names].sort());
  assert.equal(new Set(names).size, names.length);
  for (const record of value.records) {
    assert.equal(Object.isFrozen(record), true);
    assert.match(record.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(Number.isSafeInteger(record.bytes) && record.bytes >= 0, true);
    assert.equal(record.file.startsWith('/') || record.file.includes('\\') || record.file.split('/').includes('..'), false);
  }
  return value.records;
}
function disabled(value, reason) {
  assert.equal(Object.isFrozen(value), true);
  assert.equal(value.status, 'disabled');
  assert.equal(value.reason, reason);
  assert.notEqual(value.enabled, true);
}

test('the input fixture owns its nested workspace and cannot write through its dependency link', async () => {
  const original = await readFile(new URL('../package.json', import.meta.url));
  const fixture = await createNativeTerrainInputsFixture();
  try {
    assert.equal(fixture.directory, join(fixture.workspace, 'packages/lyra-map'));
    await assert.rejects(fixture.write('packages/lyra-map/node_modules/rolldown/package.json', '{}'), /never follow symlinks/u);
    await assert.rejects(fixture.write('../outside.json', '{}'), /stay inside/u);
    await fixture.write('packages/lyra-map/package.json', '{}');
    assert.deepEqual(await readFile(new URL('../package.json', import.meta.url)), original);
  } finally { await fixture.remove(); }
  assert.equal(await exists(fixture.container), false, 'cleanup removes only the owned fixture');
  assert.deepEqual(await readFile(new URL('../package.json', import.meta.url)), original);
});

test('captures exact staged root, transform and scene inputs in canonical immutable records', async context => {
  const fixture = await fixtureFor(context);
  const records = captured(await capture(fixture));
  for (const patch of patches) assert.ok((await fixture.read('pnpm-workspace.yaml')).includes(`patches/${patch}`));
  for (const file of ['.nvmrc', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', ...patches.map(name => `patches/${name}`),
    ...scripts.map(name => `packages/lyra-map/scripts/${name}.mjs`),
    ...sceneModules.map(name => `packages/lyra-map/src/scene/${name}.mjs`)]) {
    const bytes = await readFile(join(fixture.workspace, file));
    assert.deepEqual(records.find(record => record.file === file), { file, bytes: bytes.length, sha256: sha256(bytes) });
  }
});

test('relocation and process cwd do not change the canonical captured inputs', async context => {
  const first = await fixtureFor(context), second = await fixtureFor(context);
  const before = captured(await capture(first));
  assert.deepEqual(captured(await capture(second)), before);
  const cwd = process.cwd();
  try {
    process.chdir(first.enclosing);
    assert.deepEqual(captured(await capture(first)), before);
  } finally { process.chdir(cwd); }
});

test('capture requires the fixed package layout and refuses a symlinked workspace root', async context => {
  const fixture = await fixtureFor(context);
  disabled(await capture(fixture, { packageRoot: fixture.workspace,
    compilerOptions: Object.freeze({ cwd: fixture.workspace, tsconfig: false }) }), 'unsafe-input');
  const alias = join(fixture.enclosing, 'workspace-alias');
  await symlink(fixture.workspace, alias, 'dir');
  const packageRoot = join(alias, 'packages/lyra-map');
  disabled(await capture(fixture, { packageRoot,
    compilerOptions: Object.freeze({ cwd: packageRoot, tsconfig: false }) }), 'unsafe-input');
});

for (const file of ['.nvmrc', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'packages/lyra-map/package.json']) {
  test(`a missing staged ${file} disables capture without consulting an enclosing copy`, async context => {
    const fixture = await fixtureFor(context);
    const bytes = await fixture.read(file);
    await fixture.removeFile(file);
    if (!file.includes('/')) await writeFile(join(fixture.enclosing, file), bytes);
    disabled(await capture(fixture), 'missing-input');
  });
}

test('different enclosing workspace inputs are ignored rather than hashed as staged inputs', async context => {
  const fixture = await fixtureFor(context), before = captured(await capture(fixture));
  for (const file of ['.nvmrc', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json'])
    await writeFile(join(fixture.enclosing, file), 'unrelated enclosing workspace');
  assert.deepEqual(captured(await capture(fixture)), before);
});

for (const file of ['.npmrc', '.pnpmfile.cjs', '.pnpmfile.mjs']) {
  test(`records absent, empty and populated optional ${file} without executing it`, async context => {
    const fixture = await fixtureFor(context);
    await fixture.removeFile(file);
    const absent = captured(await capture(fixture));
    assert.deepEqual(absent.find(record => record.file === `@presence/${file}`), {
      file: `@presence/${file}`, bytes: 5, sha256: sha256('false')
    });
    await fixture.write(file, '');
    const empty = captured(await capture(fixture));
    assert.deepEqual(empty.find(record => record.file === `@presence/${file}`), {
      file: `@presence/${file}`, bytes: 4, sha256: sha256('true')
    });
    assert.notDeepEqual(empty, absent);
    const marker = join(fixture.workspace, 'hook-executed');
    const write = `writeFileSync(${JSON.stringify(marker)}, 'executed'); throw new Error('configuration executed');\n`;
    const content = file === '.npmrc' ? 'node-linker=isolated\n' : file.endsWith('.cjs')
      ? `const { writeFileSync } = require('node:fs'); ${write}`
      : `import { writeFileSync } from 'node:fs'; ${write}`;
    await fixture.write(file, content);
    const populated = captured(await capture(fixture));
    assert.deepEqual(populated.find(record => record.file === file), { file, bytes: Buffer.byteLength(content), sha256: sha256(content) });
    assert.notDeepEqual(populated, empty);
    assert.equal(await exists(marker), false, 'capture does not execute a configuration hook and swallow its error');
  });
}

test('referenced patch bytes participate in capture and a missing patch disables it', async context => {
  const fixture = await fixtureFor(context), patch = 'patches/braces@3.0.3.patch';
  const before = captured(await capture(fixture));
  await fixture.write(patch, `${await fixture.read(patch)}\n`);
  assert.notDeepEqual(captured(await capture(fixture)), before);
  await fixture.removeFile(patch);
  disabled(await capture(fixture), 'missing-input');
});

test('a patch reference escaping the staged root is refused even when its target exists', async context => {
  const fixture = await fixtureFor(context);
  const workspace = await fixture.read('pnpm-workspace.yaml');
  assert.ok(workspace.includes('patches/braces@3.0.3.patch'));
  await writeFile(join(fixture.enclosing, 'outside.patch'), 'outside fixture');
  await fixture.write('pnpm-workspace.yaml', workspace.replace('patches/braces@3.0.3.patch', '../outside.patch'));
  disabled(await capture(fixture), 'unsafe-input');
});

for (const file of ['.nvmrc', 'patches/braces@3.0.3.patch']) {
  test(`a symlinked authored input ${file} cannot borrow outside bytes`, async context => {
    const fixture = await fixtureFor(context), bytes = await fixture.read(file);
    const outside = join(fixture.enclosing, 'outside-input');
    await writeFile(outside, bytes);
    await fixture.removeFile(file);
    await symlink(outside, join(fixture.workspace, file));
    disabled(await capture(fixture), 'unsafe-input');
  });
}

test('manifest resolver fields and dependency declarations participate in the captured projection', async context => {
  const fixture = await fixtureFor(context);
  for (const file of ['package.json', 'packages/lyra-map/package.json']) {
    const original = await fixture.read(file), manifest = JSON.parse(original);
    const before = captured(await capture(fixture));
    const changes = { name: 'capture-test-package', type: 'commonjs', imports: { '#capture': './capture.mjs' },
      exports: { '.': './capture.mjs' }, main: './capture.cjs', module: './capture.mjs', browser: './capture.browser.mjs',
      sideEffects: false, dependencies: { 'capture-dependency': '1.0.0' }, optionalDependencies: { 'capture-optional': '1.0.0' },
      peerDependencies: { 'capture-peer': '1.0.0' }, packageManager: 'pnpm@0.0.0', engines: { node: '>=99' } };
    for (const [key, value] of Object.entries(changes)) {
      await fixture.write(file, JSON.stringify({ ...manifest, [key]: value }));
      assert.notDeepEqual(captured(await capture(fixture)), before, `${file} records ${key}`);
    }
    await fixture.write(file, JSON.stringify({ ...manifest, scripts: { ...manifest.scripts, build: 'node changed-build.mjs' } }));
    assert.notDeepEqual(captured(await capture(fixture)), before, `${file} records scripts.build`);
    for (const name of ['rolldown', 'typescript']) {
      await fixture.write(file, JSON.stringify({ ...manifest, devDependencies: { ...manifest.devDependencies, [name]: '0.0.0' } }));
      assert.notDeepEqual(captured(await capture(fixture)), before, `${file} records the ${name} compiler declaration`);
    }
    await fixture.write(file, original);
  }
});

test('package imports and exports retain semantically significant condition order', async context => {
  const fixture = await fixtureFor(context);
  for (const file of ['package.json', 'packages/lyra-map/package.json']) {
    const original = await fixture.read(file), manifest = JSON.parse(original);
    for (const field of ['imports', 'exports']) {
      const key = field === 'imports' ? '#conditional' : '.';
      await fixture.write(file, JSON.stringify({ ...manifest, [field]: {
        [key]: { browser: './browser.mjs', default: './default.mjs' }
      } }));
      const browserFirst = captured(await capture(fixture));
      await fixture.write(file, JSON.stringify({ ...manifest, [field]: {
        [key]: { default: './default.mjs', browser: './browser.mjs' }
      } }));
      assert.notDeepEqual(captured(await capture(fixture)), browserFirst,
        `${file} preserves ${field} condition priority`);
    }
    await fixture.write(file, original);
  }
});

test('explicit tsconfig false ignores package and ancestor config files and extends chains', async context => {
  const fixture = await fixtureFor(context), before = captured(await capture(fixture));
  await writeFile(join(fixture.enclosing, 'tsconfig.json'), '{"compilerOptions":{"paths":{"*": ["elsewhere/*"]}}}');
  await fixture.write('tsconfig.json', '{"extends":"../tsconfig.json","compilerOptions":{"jsx":"preserve"}}');
  await fixture.write('packages/lyra-map/tsconfig.json', '{"extends":"../../tsconfig.json"}');
  assert.deepEqual(captured(await capture(fixture)), before, 'the explicitly disabled compiler discovery has no config closure');
});

test('compiler settings require immutable own cwd and tsconfig fields bound to the staged package', async context => {
  const fixture = await fixtureFor(context);
  for (const compilerOptions of [undefined, {}, { cwd: fixture.directory, tsconfig: false },
    Object.freeze({ cwd: fixture.directory }), Object.freeze({ cwd: fixture.directory, tsconfig: true }),
    Object.freeze(Object.create({ cwd: fixture.directory, tsconfig: false })),
    Object.freeze({ cwd: fixture.enclosing, tsconfig: false }),
    Object.freeze({ cwd: fixture.directory, tsconfig: false, resolve: Object.freeze({ tsconfigFilename: 'tsconfig.json' }) })])
    disabled(await capture(fixture, { compilerOptions }), 'compiler-config');
  let reads = 0;
  const compilerOptions = Object.freeze({ get cwd() { reads++; return fixture.directory; }, tsconfig: false });
  disabled(await capture(fixture, { compilerOptions }), 'compiler-config');
  const otherOptions = Object.freeze({ cwd: fixture.directory, get tsconfig() { reads++; return false; } });
  disabled(await capture(fixture, { compilerOptions: otherOptions }), 'compiler-config');
  const resolveOptions = Object.freeze({ cwd: fixture.directory, tsconfig: false,
    get resolve() { reads++; return { tsconfigFilename: 'tsconfig.json' }; } });
  disabled(await capture(fixture, { compilerOptions: resolveOptions }), 'compiler-config');
  for (const resolve of [Object.freeze({ get tsconfigFilename() { reads++; return 'tsconfig.json'; } }),
    Object.freeze(Object.create({ tsconfigFilename: 'tsconfig.json' }))])
    disabled(await capture(fixture, { compilerOptions: Object.freeze({ cwd: fixture.directory, tsconfig: false, resolve }) }), 'compiler-config');
  assert.equal(reads, 0, 'input inspection does not invoke compiler-option getters');
});

test('the separately reviewed contract is excluded from captured input records', async context => {
  const fixture = await fixtureFor(context), file = 'packages/lyra-map/scripts/fixtures/native-terrain-contract.json';
  const before = captured(await capture(fixture));
  await fixture.write(file, JSON.stringify({ schema: 1, sourceTreeSha256, transformCompilerSha256: null }));
  assert.deepEqual(captured(await capture(fixture)), before);
  await fixture.write(file, JSON.stringify({ schema: 1, sourceTreeSha256, transformCompilerSha256: '0'.repeat(64) }));
  const after = captured(await capture(fixture));
  assert.deepEqual(after, before, 'a reviewed record cannot contribute to its own hash');
  assert.equal(after.some(record => record.file.includes('native-terrain-contract.json')), false);
});

test('input capture preserves authored bytes and does not create generated output', async context => {
  const fixture = await fixtureFor(context);
  const files = ['.nvmrc', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json',
    'packages/lyra-map/package.json', 'packages/lyra-map/scripts/build.mjs'];
  const before = await Promise.all(files.map(file => fixture.read(file)));
  const contract = join(fixture.directory, 'scripts/fixtures/native-terrain-contract.json');
  const readContract = () => readFile(contract).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
  const contractBefore = await readContract();
  captured(await capture(fixture));
  assert.deepEqual(await Promise.all(files.map(file => fixture.read(file))), before);
  assert.equal(await exists(join(fixture.directory, 'dist')), false);
  assert.deepEqual(await readContract(), contractBefore,
    'capture cannot create or qualify the authored native contract');
});
