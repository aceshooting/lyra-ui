import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { attwCommandArguments } from './packed-attw.mjs';
import { packedManifest } from './packed-tarball-input.mjs';

// These three public input examples are consumed by the documented CLI, not a test corpus.
const PUBLIC_GEN_EXAMPLES = Object.freeze([
  'examples/fixtures/contact-form.json', 'examples/fixtures/inventory-data.json', 'examples/fixtures/support-chat.json',
]);
const GUIDED_GEN_EXAMPLES = Object.freeze(['examples/guided-demo.ts', 'examples/guided-demo-host.ts']);

export const REQUIRED_GEN_FILES = Object.freeze([
  'package.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'bin/lyra-gen.mjs',
  'docs/compatibility.md', 'docs/security.md', 'docs/structured-input.md',
  'docs/interactive-chat.md', 'docs/dashboards.md',
  'docs/approval.md', 'docs/rendering.md', 'docs/stored-answer-migrations.md',
  'docs/recovery-and-diagnostics.md', 'docs/threat-matrix.md',
  'docs/navigation.md', 'examples/navigation.ts',
  'docs/server-transport.md', 'examples/server-transport.mjs',
  ...GUIDED_GEN_EXAMPLES,
  'examples/recordings/chat-review.v1.json', 'examples/saved-dashboard/README.md',
  'dist/index.js', 'dist/index.d.ts', 'dist/gen-view.js', 'dist/gen-view.d.ts',
  ...PUBLIC_GEN_EXAMPLES,
]);

/** Copy the installed archive's examples out of its package scope, as application code. */
export async function copyPackedGuidedExamples(fixture) {
  const require = createRequire(join(fixture, 'package.json'));
  const packageDirectory = dirname(require.resolve('@aceshooting/lyra-gen/package.json'));
  const destination = join(fixture, 'guided-demo');
  await mkdir(destination, { recursive: true });
  const entries = [];
  for (const source of GUIDED_GEN_EXAMPLES) {
    const target = join(destination, source.slice('examples/'.length));
    await copyFile(join(packageDirectory, source), target);
    entries.push(relative(fixture, target));
  }
  return entries;
}

/** Expand wildcard exports against the exact archive so every shipped module receives ATTW. */
export function genTypedEntrypoints(manifest, files) {
  assert.ok(manifest.exports && typeof manifest.exports === 'object', 'Generated UI must declare exports');
  const entries = new Set();
  for (const [entry, target] of Object.entries(manifest.exports)) {
    if (entry === './package.json') continue;
    assert.ok(target && typeof target === 'object' && typeof target.types === 'string' && typeof target.default === 'string', `${entry} needs paired types and runtime targets`);
    assert.ok(target.types.startsWith('./dist/') && target.default.startsWith('./dist/'), `${entry} must resolve into dist`);
    if (!entry.includes('*')) {
      assert.ok(files.includes(target.types.slice(2)) && files.includes(target.default.slice(2)), `${entry} has a missing emitted target`);
      entries.add(entry);
      continue;
    }
    assert.equal(entry.split('*').length, 2, 'Only single-pattern exports are admitted');
    assert.equal(target.default.split('*').length, 2);
    assert.equal(target.types.split('*').length, 2);
    const [prefix, suffix] = target.default.slice(2).split('*');
    let matched = 0;
    for (const file of files) {
      if (!file.startsWith(prefix) || !file.endsWith(suffix)) continue;
      const capture = file.slice(prefix.length, file.length - suffix.length);
      assert.ok(capture.length && !capture.split('/').some(part => part === '..'), 'Invalid export capture');
      assert.ok(files.includes(target.types.replace('*', capture).slice(2)), `${file} has no declaration`);
      entries.add(entry.replace('*', capture)); matched++;
    }
    assert.ok(matched > 0, `${entry} must match real archive entries`);
  }
  assert.ok(entries.has('.'), 'The generated-UI root export is required');
  return [...entries].sort();
}

export function validatePackedGenManifest(manifest, files, uiVersion) {
  assert.equal(manifest.name, '@aceshooting/lyra-gen');
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.license, 'MIT');
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const range of Object.values(manifest[section] ?? {})) assert.ok(!String(range).startsWith('workspace:'), 'lyra-gen leaks a workspace range');
  }
  assert.ok([uiVersion, `^${uiVersion}`].includes(manifest.peerDependencies?.['@aceshooting/lyra-ui']), 'lyra-gen must accept the packed public Lyra UI peer');
  assert.deepEqual([...manifest.sideEffects].sort(), ['./dist/dashboard-binding.js', './dist/gen-view.js']);
  for (const required of REQUIRED_GEN_FILES) assert.ok(files.includes(required), `lyra-gen tarball is missing ${required}`);
  for (const file of files) {
    assert.ok(!/^(?:src|test|scripts)\/|\.(?:test|stories)\.|\.map$/u.test(file), `lyra-gen tarball includes development artifact ${file}`);
    if (/(?:^|\/)fixtures\//u.test(file)) assert.ok(PUBLIC_GEN_EXAMPLES.includes(file), `lyra-gen tarball includes an unreviewed fixture ${file}`);
  }
  return genTypedEntrypoints(manifest, files);
}

/** Consumer checks run against packed dependencies in an isolated install, never workspace aliases. */
export async function verifyPackedGenConsumer({ workspace, uiTarball, genTarball, run, pnpm, root }) {
  const manifest = packedManifest(genTarball);
  const files = execFileSync('tar', ['-tzf', genTarball], { encoding: 'utf8' }).trim().split('\n')
    .filter(file => !file.endsWith('/')).map(file => file.replace(/^package\//u, ''));
  const typed = validatePackedGenManifest(manifest, files, packedManifest(uiTarball).version);
  await run(pnpm, ['exec', 'publint', 'run', '--strict', '--pack=false', genTarball], root, 'lyra-gen publint package check');
  await run(pnpm, attwCommandArguments(typed, genTarball), root, 'lyra-gen Are The Types Wrong check');
  const fixture = join(workspace, 'gen-companion-consumer');
  await mkdir(fixture, { recursive: true });
  await writeFile(join(fixture, 'package.json'), JSON.stringify({
    name: 'lyra-packed-gen-consumer', private: true, type: 'module',
    dependencies: { '@aceshooting/lyra-gen': `file:${relative(fixture, genTarball)}`, '@aceshooting/lyra-ui': `file:${relative(fixture, uiTarball)}` },
    devDependencies: { typescript: '7.0.2', lit: manifest.dependencies.lit },
  }));
  await writeFile(join(fixture, 'load.mjs'), `import assert from 'node:assert/strict';
const definitions = new Map();
globalThis.customElements = { define(name, constructor) { definitions.set(name, constructor); }, get(name) { return definitions.get(name); } };
const root = await import('@aceshooting/lyra-gen');
assert.equal(typeof root.validateView, 'function');
assert.equal(typeof root.createSurfaceState, 'function');
assert.equal(definitions.size, 0, 'pure root registered a component');
const runtime = await import('@aceshooting/lyra-gen/runtime.js');
assert.equal(runtime.validateView, root.validateView);
const schema = await import('@aceshooting/lyra-gen/schema.js');
assert.equal(schema.snapshotJson({ value: 1 }).ok, true);
const element = await import('@aceshooting/lyra-gen/gen-view.js');
assert.equal(definitions.get('lr-gen-view'), element.LyraGenViewElement);
assert.deepEqual([...definitions.keys()], ['lr-gen-view']);
`);
  await writeFile(join(fixture, 'consumer.ts'), `import { validateView, type LyraGenCatalog, type LyraGenView } from '@aceshooting/lyra-gen';
import { createSurfaceState } from '@aceshooting/lyra-gen/runtime.js';
import { LyraGenViewElement } from '@aceshooting/lyra-gen/gen-view.js';
declare const catalog: LyraGenCatalog;
declare const input: unknown;
const checked = validateView(input, catalog);
if (checked.ok) {
  const view: LyraGenView = checked.value;
  const state = createSurfaceState(view);
  const element = new LyraGenViewElement();
  element.document = view;
  element.catalog = catalog;
  element.bindingState = state.values;
}
`);
  await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], fixture, 'lyra-gen packed fixture install');
  const guidedExamples = await copyPackedGuidedExamples(fixture);
  await run(process.execPath, ['load.mjs'], fixture, 'lyra-gen pure root and granular registration');
  await run(pnpm, ['--config.auto-install-peers=false', 'exec', 'tsc', '--noEmit', '--skipLibCheck', 'false', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'consumer.ts', ...guidedExamples], fixture, 'lyra-gen packed declaration and guided example check');
}
