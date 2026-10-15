import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { sha256, withPreparedSource } from './engine/source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const scripts = path.join(root, 'scripts');
const require = createRequire(path.join(root, 'package.json'));
const sourceEntries = {
  '@docx-editor.dev/core': 'src/index.ts',
  '@docx-editor.dev/core/automation': 'src/automation/index.ts',
  '@docx-editor.dev/core/binding': 'src/binding/index.ts',
  '@docx-editor.dev/core/collaboration': 'src/collaboration/index.ts',
  '@docx-editor.dev/core/collaboration/replication': 'src/collaboration/replication.ts',
  '@docx-editor.dev/core/contracts/editor': 'src/contracts/editor.ts',
  '@docx-editor.dev/core/contracts/document': 'src/contracts/document.ts',
  '@docx-editor.dev/core/contracts/interaction': 'src/contracts/interaction.ts',
  '@docx-editor.dev/core/contracts/modules': 'src/contracts/modules.ts',
  '@docx-editor.dev/core/contracts/types': 'src/contracts/types-barrel.ts',
  '@docx-editor.dev/core/layout': 'src/layout/index.ts',
  '@docx-editor.dev/core/output': 'src/output/index.ts',
  '@docx-editor.dev/core/store': 'src/store/index.ts',
  '@docx-editor.dev/core/editor': 'src/editor/index.ts',
  '@docx-editor.dev/core/export': 'src/export/index.ts',
  '@lyra-docx-source/features/command-preparation': 'src/features/command-preparation.ts',
  '@lyra-docx-source/features/prepared-runtime': 'src/features/prepared-runtime.ts',
};

function packageManifest(name, resolver) {
  for (const directory of resolver.resolve.paths(name) ?? []) {
    const file = path.join(directory, name, 'package.json');
    if (existsSync(file)) return file;
  }
  throw new Error(`Missing maintainer engine dependency: ${name}`);
}

async function verifyBuildPackages(lock, corePackage) {
  const expected = new Map(lock.buildPackages.map(entry => [`${entry.name}@${entry.version}`, entry]));
  const seen = new Set();
  const visit = async file => {
    file = await realpath(file);
    const bytes = await readFile(file);
    const manifest = JSON.parse(bytes);
    const key = `${manifest.name}@${manifest.version}`;
    if (seen.has(key)) return;
    seen.add(key);
    assert(expected.has(key), `Unlocked engine build dependency: ${key}`);
    assert.equal(sha256(bytes), expected.get(key).manifestSha256, `Engine dependency manifest changed: ${key}`);
    const resolver = createRequire(file);
    for (const name of Object.keys(manifest.dependencies ?? {}).sort()) await visit(packageManifest(name, resolver));
  };
  await visit(corePackage);
  assert.equal(seen.size, expected.size, 'Engine build dependency inventory changed');
}

export async function buildEngine({ outputRoot = path.join(root, 'dist') } = {}) {
  const lockBytes = await readFile(path.join(scripts, 'engine-source.lock.json'));
  const lock = JSON.parse(lockBytes);
  assert.equal(process.versions.node, lock.toolchain.node, 'Use the Node version in .nvmrc to build the engine');
  assert.equal(JSON.parse(await readFile(require.resolve('vite/package.json'))).version, lock.toolchain.vite, 'Engine Vite pin changed');
  const corePackage = require.resolve('@docx-editor.dev/core/package.json');
  const coreRequire = createRequire(corePackage);
  await verifyBuildPackages(lock, corePackage);
  const assets = new Map();
  for (const asset of lock.assets) {
    let file = (asset.resolveFrom === 'core' ? coreRequire : require).resolve(asset.specifier);
    if (asset.relative) file = path.join(path.dirname(file), asset.relative);
    const bytes = await readFile(file);
    assert.equal(bytes.length, asset.bytes, `Engine asset length changed: ${asset.specifier}`);
    assert.equal(sha256(bytes), asset.sha256, `Engine asset changed: ${asset.specifier}`);
    assets.set(asset.specifier, file);
  }
  const harfBuzz = await realpath(path.join(path.dirname(coreRequire.resolve('harfbuzzjs')), 'harfbuzz.js'));
  await withPreparedSource(lock, scripts, async directory => {
    const source = path.join(directory, 'packages/core');
    let harfBuzzTransforms = 0;
    const outputFiles = new Set();
    const bundledPackages = new Map();
    await build({
      configFile: false,
      root,
      base: './',
      publicDir: false,
      define: { __DOCX_HARFBUZZ_WASM_URL_SUPPORTED__: 'true' },
      plugins: [{
        name: 'lyra-docx-pinned-source',
        enforce: 'pre',
        async resolveId(id, importer) {
          if (Object.hasOwn(sourceEntries, id)) return path.join(source, sourceEntries[id]);
          if (id === 'module' && importer && path.resolve(importer.split('?')[0]) === harfBuzz) return path.join(source, 'src/layout/node-module-shim.ts');
          if (importer?.startsWith(`${source}${path.sep}`) && !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0')) {
            assert(!id.startsWith('@docx-editor.dev/core'), `Unlocked core source route: ${id}`);
            return this.resolve(id, corePackage, { skipSelf: true });
          }
        },
        transform(code, id) {
          if (path.resolve(id.split('?')[0]) !== harfBuzz) return;
          const needle = 'new URL("harfbuzz.wasm",import.meta.url).href';
          assert.equal(code.split(needle).length - 1, 1, 'Upstream HarfBuzz URL expression changed');
          harfBuzzTransforms++;
          return {
            code: `import{resolveHarfBuzzWasmBinaryUrl as resolveDocxWasmUrl}from${JSON.stringify(path.join(source, 'src/layout/harfbuzz-wasm-binary.ts'))};${code.replace(needle, () => 'resolveDocxWasmUrl(new URL("harfbuzz.wasm?no-inline",import.meta.url).href)')}`,
            map: null,
          };
        },
        generateBundle(_options, bundle) {
          for (const [file, entry] of Object.entries(bundle)) {
            outputFiles.add(file);
            if (entry.type === 'chunk') {
              for (const id of [...entry.imports, ...entry.dynamicImports]) {
                assert(bundle[id]?.type === 'chunk', `Unbundled engine import in ${file}: ${id}`);
              }
              for (const [id, module] of Object.entries(entry.modules)) {
                if (!module.renderedLength || !id.includes(`${path.sep}node_modules${path.sep}`)) continue;
                let directory = path.dirname(id.split('?')[0]);
                while (directory !== path.dirname(directory)) {
                  const manifestFile = path.join(directory, 'package.json');
                  if (existsSync(manifestFile)) {
                    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
                    if (manifest.name && manifest.version) {
                      bundledPackages.set(`${manifest.name}@${manifest.version}`, { name: manifest.name, version: manifest.version, license: manifest.license });
                      break;
                    }
                  }
                  directory = path.dirname(directory);
                }
              }
            }
          }
        },
      }],
      build: {
        outDir: path.join(outputRoot, 'engine'),
        emptyOutDir: true,
        sourcemap: false,
        // Distribution modules must leave application preload URLs to the consumer bundler.
        lib: {
          entry: { core: path.join(scripts, 'engine/entries/core.ts'), store: path.join(scripts, 'engine/entries/store.ts') },
          formats: ['es'],
          fileName: (_format, name) => `${name}.js`,
        },
        rollupOptions: {
          output: {
            // Compact library output while preserving annotations used by consumer tree shaking.
            minify: { codegen: true },
            comments: { annotation: true },
          },
        },
      },
    });
    assert.equal(harfBuzzTransforms, 1, 'Required HarfBuzz loader transform did not run exactly once');
    const outputAssets = [];
    for (const file of [...outputFiles].sort()) {
      const bytes = await readFile(path.join(outputRoot, 'engine', file));
      if (file.endsWith('.js')) {
        // Vite's library mode omits its app warning; retain the same 500 kB ceiling as a hard gate.
        assert(bytes.length <= 500_000, `Engine chunk exceeds the normal 500 kB limit: ${file} (${bytes.length} bytes)`);
        assert(!bytes.includes(Buffer.from('__vite__mapDeps')), `Engine contains application preload URLs: ${file}`);
      }
      outputAssets.push({ file, bytes: bytes.length, sha256: sha256(bytes) });
    }
    const wasmAssets = outputAssets.filter(asset => asset.file.endsWith('.wasm'));
    const expectedWasm = lock.assets.find(asset => asset.relative === 'harfbuzz.wasm');
    assert.equal(wasmAssets.length, 1, 'The engine must emit one external HarfBuzz binary');
    assert.equal(wasmAssets[0].sha256, expectedWasm.sha256, 'Emitted HarfBuzz binary differs from its locked input');
    const buildInputs = [];
    for (const file of ['build-engine.mjs', 'engine/source.mjs', 'engine/entries/core.ts', 'engine/entries/store.ts']) {
      buildInputs.push({ file, sha256: sha256(await readFile(path.join(scripts, file))) });
    }
    await mkdir(path.join(outputRoot, 'docx'), { recursive: true });
    await copyFile(assets.get('@docx-editor.dev/core/styles/editor.css'), path.join(outputRoot, 'docx/editor.css'));
    await writeFile(path.join(outputRoot, 'engine/provenance.json'), `${JSON.stringify({
      sourceLockSha256: sha256(lockBytes),
      sourceCommit: lock.upstream.commit,
      archiveSha256: lock.upstream.archiveSha256,
      toolchain: lock.toolchain,
      buildInputs,
      bundledPackages: [...bundledPackages.values()].sort((a, b) => a.name.localeCompare(b.name)),
      assets: outputAssets.sort((a, b) => a.file.localeCompare(b.file)),
    }, null, 2)}\n`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildEngine();
