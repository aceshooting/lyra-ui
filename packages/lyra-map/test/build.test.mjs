import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createScratchPackage } from '../scripts/scratch-package.mjs';
import { CHANGED_SOURCE_FILES, upstreamRoot } from './pinned-upstream.mjs';
import { relocateUpstream } from './relocated-upstream.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const exists = (file) => access(file).then(() => true, () => false);
const text = (directory, file) => readFile(join(directory, file), 'utf8');
const pin = JSON.parse(await text(packageRoot, 'UPSTREAM.json'));
const controls = {
  attribution: 'AttributionControl',
  navigation: 'NavigationControl',
  geolocate: 'GeolocateControl',
  scale: 'ScaleControl',
  fullscreen: 'FullscreenControl',
  terrain: 'TerrainControl',
  globe: 'GlobeControl',
  logo: 'LogoControl',
};

function build(directory) {
  return spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: directory, encoding: 'utf8' });
}

let built;
let result;
let provenance;
before(async () => {
  built = await createScratchPackage();
  result = build(built.directory);
  assert.equal(result.status, 0, result.stderr);
  provenance = JSON.parse(await text(built.directory, 'dist/provenance.json'));
});
after(() => built?.remove());

test('builds the engine from the pinned source and reports what it generated', () => {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `Built ${provenance.modules.length} engine modules from MapLibre ${pin.version}.\n`);
});

test('the root and worker entries point into the content-addressed module graph', async () => {
  const files = new Set(provenance.modules.map((module) => module.file));
  const root = /^export \* from '\.\/(modules\/index-[\w-]+\.mjs)';\n$/u.exec(await text(built.directory, 'dist/index.mjs'));
  assert.ok(root && files.has(root[1]), 'the root re-exports a generated module');
  const worker = /^import '\.\/(modules\/worker-[\w-]+\.mjs)';\n$/u.exec(await text(built.directory, 'dist/worker.mjs'));
  assert.ok(worker && files.has(worker[1]), 'the worker entry imports a generated module');
});

test('each control has a granular entry and a declaration that reuses the root types', async () => {
  const files = new Set(provenance.modules.map((module) => module.file));
  assert.deepEqual((await readdir(join(built.directory, 'dist/controls'))).sort(),
    Object.keys(controls).flatMap((name) => [`${name}.d.ts`, `${name}.mjs`]).sort());
  for (const [name, exported] of Object.entries(controls)) {
    const entry = new RegExp(`^export \\{${exported}\\} from '\\.\\./(modules/control-${name}-[\\w-]+\\.mjs)';\\n$`, 'u')
      .exec(await text(built.directory, `dist/controls/${name}.mjs`));
    assert.ok(entry && files.has(entry[1]), `${name} entry loads its own module`);
    assert.equal(await text(built.directory, `dist/controls/${name}.d.ts`), `export {${exported}} from '../index.js';\n`);
  }
});

test('publishes declarations that describe the asynchronous preparation API', async () => {
  const declarations = await text(built.directory, 'dist/index.d.ts');
  assert.ok(declarations.startsWith('/// <reference types="geojson" />\n'), 'consumers need no ambient GeoJSON setup');
  for (const signature of [
    'setState(nextState: StyleSpecification, options?: StyleSwapOptions & StyleSetterOptions): Promise<boolean>;',
    '_load(json: StyleSpecification, options: StyleSwapOptions & StyleSetterOptions, previousStyle?: StyleSpecification): Promise<void>;',
    '_updateDiff(style: StyleSpecification, options?: StyleSwapOptions & StyleOptions): Promise<void>;',
    'prepareFeatures(requirements: MapFeatureRequirements, options?: MapFeaturePreparationOptions): Promise<void>;',
    'addPreparedFeatures(descriptors: MapPreparedFeatures, options?: MapFeaturePreparationOptions): Promise<this>;',
  ]) assert.ok(declarations.includes(signature), signature);
  for (const replaced of [
    'setState(nextState: StyleSpecification, options?: StyleSwapOptions & StyleSetterOptions): boolean;',
    '_load(json: StyleSpecification, options: StyleSwapOptions & StyleSetterOptions, previousStyle?: StyleSpecification): void;',
    '_updateDiff(style: StyleSpecification, options?: StyleSwapOptions & StyleOptions): void;',
  ]) assert.ok(!declarations.includes(replaced), `the synchronous signature ${replaced} is replaced`);
  assert.ok(declarations.endsWith(await text(packageRoot, 'types/features.d.ts')), 'the package declarations close the file');
});

test('vendors the declaration packages that use extensionless relative imports', async () => {
  const declarations = await text(built.directory, 'dist/index.d.ts');
  assert.deepEqual((await readdir(join(built.directory, 'dist/types'))).sort(), ['geojson-vt.d.ts', 'vt-pbf.d.ts']);
  for (const { package: name } of pin.declarationSources) {
    const file = name.split('/').at(-1);
    assert.ok(!declarations.includes(`from "${name}"`), `${name} is no longer imported by name`);
    assert.ok(declarations.includes(`from "./types/${file}.js"`), `${name} is imported from the vendored copy`);
    assert.doesNotMatch(await text(built.directory, `dist/types/${file}.d.ts`), /sourceMappingURL/u);
  }
});

test('copies the stylesheet and the Vite plugin without change', async () => {
  assert.equal(await text(built.directory, 'dist/map.css'), await text(upstreamRoot, 'dist/maplibre-gl.css'));
  for (const file of ['vite.mjs', 'vite.d.ts']) {
    assert.equal(await text(built.directory, `dist/${file}`), await text(packageRoot, `src/${file}`));
  }
});

test('records provenance that matches the pin and the generated files', async () => {
  assert.equal(provenance.upstream, pin.upstream);
  assert.equal(provenance.version, pin.version);
  assert.equal(provenance.sourceTreeSha256, pin.sourceTreeSha256);
  assert.deepEqual(provenance.changedSourceFiles, CHANGED_SOURCE_FILES);
  assert.equal(provenance.generatedFeatureModules, 31);
  assert.ok(provenance.modules.length > 0 && provenance.modules.length < 700);
  const listed = new Set(provenance.modules.map((module) => module.file));
  assert.equal(listed.size, provenance.modules.length, 'module files are unique');
  const onDisk = (await readdir(join(built.directory, 'dist/modules'))).map((name) => `modules/${name}`);
  assert.deepEqual([...listed].sort(), onDisk.sort(), 'every generated module is listed and nothing else is shipped');
  for (const module of provenance.modules) {
    const code = await readFile(join(built.directory, 'dist', module.file));
    assert.equal(code.length, module.bytes, module.file);
    assert.equal(sha256(code), module.sha256, module.file);
    for (const dependency of [...module.imports, ...module.dynamicImports]) assert.ok(listed.has(dependency), `${module.file} -> ${dependency}`);
  }
});

test('generated modules carry no source maps and no build machine paths', async () => {
  for (const module of provenance.modules) {
    const code = await text(built.directory, `dist/${module.file}`);
    assert.ok(!code.includes('sourceMappingURL='), module.file);
    assert.ok(!code.includes(built.directory), module.file);
    assert.ok(!code.includes(upstreamRoot), module.file);
  }
});

// Tampering with the reviewed pin must stop the build before it writes anything that looks complete.
const refusals = [
  ['an upstream version other than the reviewed one', (record) => { record.version = '0.0.0'; }, /MapLibre package differs from the reviewed source pin\./u],
  ['a package manifest that is not the reviewed one', (record) => { record.packageJsonSha256 = '0'.repeat(64); }, /MapLibre package differs from the reviewed source pin\./u],
  ['a source tree that is not the reviewed one', (record) => { record.sourceTreeSha256 = '0'.repeat(64); }, /MapLibre source tree differs from the reviewed source pin\./u],
  ['a license that is not the reviewed one', (record) => { record.license.sha256 = '0'.repeat(64); }, /MapLibre license differs from the reviewed source pin\./u],
];
for (const [name, tamper, message] of refusals) {
  test(`refuses ${name} before generating any output`, async () => {
    const scratch = await createScratchPackage();
    try {
      const record = structuredClone(pin);
      tamper(record);
      await writeFile(join(scratch.directory, 'UPSTREAM.json'), JSON.stringify(record));
      const failed = build(scratch.directory);
      assert.notEqual(failed.status, 0);
      assert.match(failed.stderr, message);
      assert.equal(await exists(join(scratch.directory, 'dist')), false, 'no distribution directory is created');
    } finally {
      await scratch.remove();
    }
  });
}

test('refuses declaration sources that changed after review without publishing provenance', async () => {
  const scratch = await createScratchPackage();
  try {
    const record = structuredClone(pin);
    record.declarationSources[0].sha256 = '0'.repeat(64);
    await writeFile(join(scratch.directory, 'UPSTREAM.json'), JSON.stringify(record));
    const failed = build(scratch.directory);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /Declaration source changed: @maplibre\/geojson-vt/u);
    for (const file of ['dist/index.d.ts', 'dist/provenance.json']) {
      assert.equal(await exists(join(scratch.directory, file)), false, `${file} is not published`);
    }
  } finally {
    await scratch.remove();
  }
});

// The bundler runs against a private copy of upstream source that is re-pinned after one edit, so the
// pin accepts it and only the build's own checks on the upstream's shape can refuse it.
const drift = [
  ['moved worker URL source anchor', 'src/util/web_worker.ts',
    (code) => code.replace('function defaultWorkerUrl(): string {', 'function defaultWorkerLocation(): string {'), /Worker URL source anchor changed\./u],
  ['moved declaration anchor', 'dist/maplibre-gl.d.ts',
    (code) => code.replace('setState(nextState: StyleSpecification,', 'setStateNow(nextState: StyleSpecification,'),
    /Declaration anchor changed: setState\(nextState: StyleSpecification/u],
  ['bundler warning about an unresolvable import', 'src/util/dom.ts',
    (code) => `import 'a-package-that-is-not-installed';\n${code}`, /Engine build warning UNRESOLVED_IMPORT/u],
  ['bundler warning about direct eval', 'src/util/dom.ts',
    (code) => `${code}\nexport const evaluated = eval('1');\n`, /Engine build warning EVAL/u],
];
for (const [name, file, change, message] of drift) {
  test(`refuses upstream source with a ${name}`, async () => {
    const scratch = await createScratchPackage();
    try {
      const relocated = await relocateUpstream(scratch.directory, packageRoot);
      await relocated.edit(file, change);
      await relocated.repin();
      const failed = build(scratch.directory);
      assert.notEqual(failed.status, 0);
      assert.match(failed.stderr, message);
      assert.equal(await exists(join(scratch.directory, 'dist/provenance.json')), false, 'no provenance is published');
    } finally {
      await scratch.remove();
    }
  });
}

test('refuses a generated module whose file name looks like a dependency path', async () => {
  const scratch = await createScratchPackage();
  try {
    const relocated = await relocateUpstream(scratch.directory, packageRoot);
    await writeFile(join(relocated.upstream, 'src/util/node_modules.ts'), 'export const marker = 1;\n');
    await relocated.edit('src/util/dom.ts', (code) => `import './node_modules.ts';\n${code}`);
    await relocated.repin();
    const failed = build(scratch.directory);
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /Unsafe generated module path\./u);
    assert.equal(await exists(join(scratch.directory, 'dist/provenance.json')), false);
  } finally {
    await scratch.remove();
  }
});

test('an unedited private copy of upstream builds the same engine, so refusals come from the edits', async () => {
  const scratch = await createScratchPackage();
  try {
    const relocated = await relocateUpstream(scratch.directory, packageRoot);
    const repinned = await relocated.repin();
    assert.equal(repinned.sourceTreeSha256, pin.sourceTreeSha256, 'the copy is byte-identical to the reviewed tree');
    const copy = build(scratch.directory);
    assert.equal(copy.status, 0, copy.stderr);
    const record = JSON.parse(await text(scratch.directory, 'dist/provenance.json'));
    assert.deepEqual(record.changedSourceFiles, CHANGED_SOURCE_FILES);
    assert.equal(record.modules.length, provenance.modules.length);
  } finally {
    await scratch.remove();
  }
});
