import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findBareGlobalIsNaNCalls,
  findDoubleQuotedStringLiterals,
  findNulByteLines,
} from '../../lyra-ui/scripts/check-source-policy.mjs';
import { staticModuleSpecifiers } from '../../lyra-ui/scripts/module-specifiers.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = path.resolve(packageRoot, '../..');
const read = (file) => readFileSync(path.join(packageRoot, file), 'utf8');
const files = (directory) => readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath, entry.name))
  .sort();
const manifest = JSON.parse(read('package.json'));

assert.equal(manifest.name, '@aceshooting/lyra-3d');
assert.match(manifest.version, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u, 'Release tooling accepts only stable versions');
assert.equal(manifest.private, undefined, 'The 3D package must be publishable');
assert.equal(manifest.type, 'module');
assert.equal(manifest.license, 'MIT');
assert.equal(manifest.engines.node, '>=22');
assert.equal(manifest.packageManager, JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).packageManager);
assert.deepEqual(manifest.publishConfig, { access: 'public' });
assert.equal(manifest.repository.directory, 'packages/lyra-3d');
assert.deepEqual(manifest.sideEffects, ['./dist/**/*.worker.js']);
assert.deepEqual(manifest.files, ['dist', 'README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']);
assert.deepEqual(manifest.exports, {
  './core': { types: './dist/core/index.d.ts', default: './dist/core/index.js' },
  './graph': { types: './dist/graph/index.d.ts', default: './dist/graph/index.js' },
  './points': { types: './dist/points/index.d.ts', default: './dist/points/index.js' },
  './panorama': { types: './dist/panorama/index.d.ts', default: './dist/panorama/index.js' },
  './model': { types: './dist/model/index.d.ts', default: './dist/model/index.js' },
  './xr': { types: './dist/xr/index.d.ts', default: './dist/xr/index.js' },
  './graph-layout': { types: './dist/graph-layout/index.d.ts', default: './dist/graph-layout/index.js' },
  './package.json': './package.json',
});
assert.deepEqual(manifest.imports, {
  '#graph-layout-signal-brand': {
    types: './dist/graph-layout/signal-brand-browser.d.ts',
    browser: './dist/graph-layout/signal-brand-browser.js',
    node: './dist/graph-layout/signal-brand-node.js',
    default: './dist/graph-layout/signal-brand-browser.js',
  },
});
assert.deepEqual(Object.keys(manifest.dependencies), ['three']);
assert.match(manifest.dependencies.three, /^\^0\.\d+\.\d+$/u, 'three is one caret range so applications dedupe it');
assert.deepEqual(manifest.peerDependencies, { '@types/three': manifest.devDependencies['@types/three'] });
assert.deepEqual(manifest.peerDependenciesMeta, { '@types/three': { optional: true } });
assert(!JSON.parse(readFileSync(path.join(repoRoot, '.changeset/config.json'), 'utf8')).fixed.flat().includes(manifest.name),
  'The 3D package versions independently of the fixed Lyra UI group');

// The shipped notice carries the installed three.js license verbatim.
const threeRoot = path.join(packageRoot, 'node_modules', 'three');
const three = JSON.parse(readFileSync(path.join(threeRoot, 'package.json'), 'utf8'));
const notices = read('THIRD_PARTY_NOTICES.md');
assert.equal(three.license, 'MIT');
assert(notices.includes(`## three ${manifest.dependencies.three}`), 'THIRD_PARTY_NOTICES.md names the declared three range');
assert(notices.includes(readFileSync(path.join(threeRoot, 'LICENSE'), 'utf8').trim()), 'THIRD_PARTY_NOTICES.md carries the three.js license text');
assert(read('LICENSE').startsWith('MIT License'), 'LICENSE is the MIT license');
assert(/^# @aceshooting\/lyra-3d\s/u.test(read('CHANGELOG.md')));

for (const file of files(path.join(packageRoot, 'src'))) {
  const source = readFileSync(file, 'utf8');
  assert.deepEqual(findDoubleQuotedStringLiterals(source), [], `String literal policy: ${file}`);
  assert.deepEqual(findNulByteLines(source), [], `NUL byte: ${file}`);
  assert.deepEqual(findBareGlobalIsNaNCalls(source, file), [], `Finite number policy: ${file}`);
}

if (existsSync(path.join(packageRoot, 'dist'))) {
  for (const entry of Object.values(manifest.exports)) {
    for (const target of typeof entry === 'string' ? [entry] : Object.values(entry)) {
      assert(existsSync(path.join(packageRoot, target)), `Missing export target ${target}`);
    }
  }
  // The granular support/types entry must not acquire native or renderer dependencies,
  // including through declarations that consumers load without the optional engines.
  for (const extension of ['.js', '.d.ts']) {
    const visited = new Set();
    const inspectXrEntry = (name) => {
      assert(['index', 'support', 'types'].includes(name), `Unexpected public XR dependency ${name}`);
      if (visited.has(name)) return;
      visited.add(name);
      const file = path.join(packageRoot, 'dist/xr', name + extension);
      const source = readFileSync(file, 'utf8');
      assert(!/\bimport\s*\(/u.test(source), `Dynamic dependency in public XR entry ${file}`);
      if (extension === '.d.ts') {
        assert(!/\b(?:XR[A-Z]\w*|WebGL\w*|WebXR|THREE)\b/u.test(source), `Platform type in public XR declarations ${file}`);
        assert(!/\/\/\/\s*<reference\b/u.test(source), `Ambient dependency in public XR declarations ${file}`);
      }
      for (const specifier of staticModuleSpecifiers(file, source)) {
        const match = /^\.\/(support|types)\.js$/u.exec(specifier);
        assert(match, `Unexpected public XR import ${specifier} in ${file}`);
        inspectXrEntry(match[1]);
      }
    };
    inspectXrEntry('index');
  }
  for (const file of files(path.join(packageRoot, 'dist'))) {
    assert(/\.(?:js|d\.ts)$/u.test(file), `Unexpected build output ${file}`);
    const code = readFileSync(file, 'utf8');
    assert(!code.includes('sourceMappingURL='), `Source map reference in ${file}`);
    assert(!/\/(?:home|mnt|Users)\//u.test(code), `Workspace path in ${file}`);
    if (!file.endsWith('.js')) continue;
    // Engines import nothing from Lyra UI; the component validates them structurally instead.
    for (const specifier of staticModuleSpecifiers(file, code)) {
      const relativeFile = path.relative(packageRoot, file).split(path.sep).join('/');
      const signalAdapter = relativeFile === 'dist/graph-layout/async.js' && specifier === '#graph-layout-signal-brand';
      const nodeSignalBrand = relativeFile === 'dist/graph-layout/signal-brand-node.js' && specifier === 'node:util';
      if (relativeFile.startsWith('dist/graph-layout/')) {
        const siblingHelper = /^\.\/[a-z][a-z0-9-]*\.js$/u.test(specifier)
          && path.dirname(path.resolve(path.dirname(file), specifier)) === path.dirname(file);
        assert(siblingHelper || signalAdapter || nodeSignalBrand,
          `Graph layout must not import renderer dependencies: ${specifier} in ${file}`);
      }
      assert(specifier.startsWith('./') || specifier.startsWith('../') || specifier === 'three' || specifier.startsWith('three/') || signalAdapter || nodeSignalBrand,
        `Unexpected import ${specifier} in ${file}`);
    }
  }
}
console.log('3D package manifest, notices, sources and build output checks passed.');
