import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import fs from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compactBuildJavaScript, pruneEmptyBuildJavaScript } from './compact-build-js.mjs';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('@web/dev-server-esbuild'))('esbuild');

const fixture = await mkdtemp(path.join(tmpdir(), 'lyra-compact-js-'));
try {
  const nested = path.join(fixture, 'nested');
  await mkdir(nested);
  await writeFile(path.join(fixture, 'package.json'), '{"type":"module"}\n');
  await writeFile(
    path.join(nested, 'entry.js'),
    `// duplicate authored prose does not ship in JavaScript\nexport class ReadableName {\n  method(longLocalValue) { return longLocalValue + 1; }\n}\nexport const syntaxOnly = true ? 'kept' : 'discarded';\n`,
  );
  await writeFile(
    path.join(nested, 'cli.mjs'),
    `// copied public executables are emitted after the main build\nexport function migrate(value) { return value ?? 'fallback'; }\n`,
  );
  await writeFile(path.join(nested, 'entry.d.ts'), '/** IDE documentation stays. */\nexport class ReadableName {}\n');
  // Translation catalogs are mostly non-ASCII prose. ES modules are UTF-8 by definition, so the
  // published bytes keep the characters themselves rather than six-byte `\\uXXXX` escapes.
  await writeFile(
    path.join(nested, 'strings.js'),
    "export const strings = { noData: '\u0644\u0627 \u062a\u0648\u062c\u062f', ellipsis: '\u2026' };\n",
  );
  const result = await compactBuildJavaScript(fixture);
  assert.equal(result.files, 3);
  assert.ok(result.afterBytes < result.beforeBytes);
  const output = await readFile(path.join(nested, 'entry.js'), 'utf8');
  assert.doesNotMatch(output, /duplicate authored prose|sourceMappingURL/);
  const publishedEntry = await import(pathToFileURL(path.join(nested, 'entry.js')).href);
  assert.equal(publishedEntry.ReadableName.name, 'ReadableName');
  assert.equal(new publishedEntry.ReadableName().method(2), 3);
  assert.match(output, /kept/);
  assert.doesNotMatch(output, /discarded/);
  assert.doesNotMatch(output, /true\s*\?/);
  const stringsOutput = await readFile(path.join(nested, 'strings.js'), 'utf8');
  assert.match(stringsOutput, /\u0644\u0627 \u062a\u0648\u062c\u062f/u, 'non-ASCII text ships as UTF-8');
  assert.match(stringsOutput, /\u2026/u);
  assert.doesNotMatch(stringsOutput, /\\u[0-9a-fA-F]{4}/u, 'no `\\uXXXX` escapes for printable characters');
  const cliOutput = await readFile(path.join(nested, 'cli.mjs'), 'utf8');
  assert.doesNotMatch(cliOutput, /copied public executables/);
  const cli = await import(pathToFileURL(path.join(nested, 'cli.mjs')).href);
  assert.equal(cli.migrate.name, 'migrate');
  assert.equal(cli.migrate(null), 'fallback');
  assert.match(await readFile(path.join(nested, 'entry.d.ts'), 'utf8'), /IDE documentation stays/);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

// A type-only source file (all `import type`/`export type`) compiles to a bare `export {};`
// module marker -- no runtime statements survive emission. esbuild's printer drops that empty
// export clause entirely when asked to minify whitespace, since it exports nothing; left alone,
// that silently turns a real ES module into a 0-byte non-module file. Consumers importing it
// (e.g. `import type {} from '@aceshooting/lyra-ui/custom-elements-jsx'`) still need a module.
const markerFixture = await mkdtemp(path.join(tmpdir(), 'lyra-compact-js-marker-'));
try {
  await writeFile(path.join(markerFixture, 'types-only.js'), 'export {};\n');
  await compactBuildJavaScript(markerFixture);
  const output = await readFile(path.join(markerFixture, 'types-only.js'), 'utf8');
  assert.equal(output, 'export {};\n');
} finally {
  await rm(markerFixture, { recursive: true, force: true });
}



// The bootstrap serializes these function bodies. Compact local names without renaming their
// module bindings, introducing closed-over helpers, or changing the standalone script behavior.
const bootstrapFixture = await mkdtemp(path.join(tmpdir(), 'lyra-compact-bootstrap-'));
try {
  const themeDirectory = path.join(bootstrapFixture, 'theme');
  await mkdir(themeDirectory);
  await writeFile(path.join(bootstrapFixture, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(themeDirectory, 'style-ownership.js'), `
    export function readStyleOwnership(longOwnershipValue) { return longOwnershipValue + 1; }
  `);
  await writeFile(path.join(themeDirectory, 'startup-resolution.js'), `
    export function resolveStyleStartup(longStartupValue) { return longStartupValue; }
  `);
  await writeFile(path.join(themeDirectory, 'theme.js'), `
    import { readStyleOwnership } from './style-ownership.js';
    import { resolveStyleStartup } from './startup-resolution.js';
    export const preservedLabel = 'Résumé 🦉';
    function applyStoredThemeBeforePaint(longPaintValue) { return longPaintValue * 2; }
    function styleTokenAllowed(longTokenValue) { return longTokenValue > 0; }
    function styleMaterial(longMaterialValue) { return longMaterialValue; }
    function applyStoredStyleBeforePaint(longInputValue, paintCallback, allowedCallback, ownershipCallback, startupCallback, materialCallback) {
      const resolvedValue = materialCallback(startupCallback(longInputValue));
      return allowedCallback(resolvedValue) ? ownershipCallback(paintCallback(resolvedValue)) : 0;
    }
    export function createLyraThemeBootstrap() { return publicBootstrap(7); }
    export const lyraThemeBootstrap = /* @__PURE__ */ createLyraThemeBootstrap();
    export function publicBootstrap(value) {
      return '(' + applyStoredStyleBeforePaint.toString() + ')(' + value + ',' +
        applyStoredThemeBeforePaint.toString() + ',' + styleTokenAllowed.toString() + ',' +
        readStyleOwnership.toString() + ',' + resolveStyleStartup.toString() + ',' +
        styleMaterial.toString() + ')';
    }
  `);
  const originalSource = await readFile(path.join(themeDirectory, 'theme.js'), 'utf8');
  const originalOwnership = await readFile(path.join(themeDirectory, 'style-ownership.js'), 'utf8');
  const originalStartup = await readFile(path.join(themeDirectory, 'startup-resolution.js'), 'utf8');
  const url = pathToFileURL(path.join(themeDirectory, 'theme.js')).href;
  const before = await import(url);
  const uncompressed = before.publicBootstrap(7);
  await compactBuildJavaScript(bootstrapFixture);
  const compactedSource = await readFile(path.join(themeDirectory, 'theme.js'), 'utf8');
  const compactedOwnership = await readFile(path.join(themeDirectory, 'style-ownership.js'), 'utf8');
  const compactedStartup = await readFile(path.join(themeDirectory, 'startup-resolution.js'), 'utf8');
  await compactBuildJavaScript(bootstrapFixture);
  const published = path.join(bootstrapFixture, 'published');
  await cp(themeDirectory, published, { recursive: true });
  // A separate module path also reloads the compacted ownership import, not its cached original.
  const after = await import(pathToFileURL(path.join(published, 'theme.js')).href);
  const compressed = after.publicBootstrap(7);
  assert.ok(compressed.length < uncompressed.length);
  assert.doesNotMatch(compressed, /longInputValue|longPaintValue|longTokenValue|longOwnershipValue|longStartupValue|longMaterialValue/u);
  assert.match(compactedSource, /\/\* @__PURE__ \*\//u);
  const unusedBootstrap = await esbuild.build({
    stdin: { contents: "export { preservedLabel } from './theme/theme.js';", resolveDir: bootstrapFixture },
    bundle: true, write: false, format: 'esm', treeShaking: true,
  });
  assert.doesNotMatch(unusedBootstrap.outputFiles[0].text, /toString|publicBootstrap|applyStored/u,
    'a consumer using another export drops the bootstrap initializer and serialized generators');
  const usedBootstrap = await esbuild.build({
    stdin: { contents: "export { lyraThemeBootstrap } from './theme/theme.js';", resolveDir: bootstrapFixture },
    bundle: true, write: false, format: 'esm', treeShaking: true,
  });
  const bundled = await import('data:text/javascript;base64,' + Buffer.from(usedBootstrap.outputFiles[0].text).toString('base64'));
  assert.equal(Function('return ' + bundled.lyraThemeBootstrap)(), 15,
    'consuming the bootstrap keeps its initializer and standalone script behavior');
  assert.equal(after.publicBootstrap.name, 'publicBootstrap');
  assert.equal(after.preservedLabel, 'Résumé 🦉');
  assert.equal(Function('return ' + compressed)(), 15);
  assert.equal(Function('return ' + after.publicBootstrap(-1))(), 0);
  assert.equal(after.createLyraThemeBootstrap.name, 'createLyraThemeBootstrap');
  // Repeated minification may choose different short names; fresh identical build inputs must
  // still reproduce byte-identical output. The second-pass module above proves semantic stability.
  const repeat = path.join(bootstrapFixture, 'repeat');
  await mkdir(path.join(repeat, 'theme'), { recursive: true });
  await writeFile(path.join(repeat, 'theme/theme.js'), originalSource);
  await writeFile(path.join(repeat, 'theme/style-ownership.js'), originalOwnership);
  await writeFile(path.join(repeat, 'theme/startup-resolution.js'), originalStartup);
  await compactBuildJavaScript(repeat);
  assert.equal(await readFile(path.join(repeat, 'theme/theme.js'), 'utf8'), compactedSource);
  assert.equal(await readFile(path.join(repeat, 'theme/style-ownership.js'), 'utf8'), compactedOwnership);
  assert.equal(await readFile(path.join(repeat, 'theme/startup-resolution.js'), 'utf8'), compactedStartup);
  for (const replacement of ['createLyraThemeBootstrap(1)', 'publicBootstrap(7)', '"createLyraThemeBootstrap()"']) {
    await writeFile(path.join(themeDirectory, 'theme.js'), originalSource.replace(
      '/* @__PURE__ */ createLyraThemeBootstrap()', replacement));
    await assert.rejects(compactBuildJavaScript(bootstrapFixture), /pure initializer inventory changed/u,
      `changed initializer must fail closed: ${replacement}`);
  }

} finally {
  await rm(bootstrapFixture, { recursive: true, force: true });
}

// Use the real collection boundary, not a substitute initializer: event-only imports must not
// retain property installation, while full support still snapshots registered reactive accessors.
const collectionFixture = await mkdtemp(path.join(tmpdir(), 'lyra-compact-collection-'));
try {
  const internal = path.join(collectionFixture, 'internal');
  await mkdir(internal);
  for (const name of ['collection-snapshot', 'data-descriptors']) {
    const source = await readFile(new URL(`../src/internal/${name}.ts`, import.meta.url), 'utf8');
    const emitted = await esbuild.transform(source, { loader: 'ts', format: 'esm', target: 'es2022' });
    await writeFile(path.join(internal, `${name}.js`), emitted.code);
  }
  await writeFile(path.join(internal, 'dev-warning.js'), 'export function devWarnOnce() {}');
  await compactBuildJavaScript(collectionFixture);
  const published = await readFile(path.join(internal, 'collection-snapshot.js'), 'utf8');
  async function consume(exported) {
    const result = await esbuild.build({
      stdin: { contents: `export { ${exported} } from './internal/collection-snapshot.js';`, resolveDir: collectionFixture },
      bundle: true, write: false, format: 'esm', treeShaking: true,
      plugins: [{ name: 'collection-lit-fixture', setup(build) {
        build.onResolve({ filter: /^lit$/ }, () => ({ path: 'lit', namespace: 'collection-lit' }));
        build.onLoad({ filter: /.*/, namespace: 'collection-lit' }, () => ({ contents: 'export class LitElement {}' }));
      } }],
    });
    const code = result.outputFiles[0].text;
    return { code, exports: await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')) };
  }
  const eventOnly = await consume('eventCollectionSupport');
  assert.doesNotMatch(eventOnly.code, /installOwnedCollectionAccessors|ownershipBoundarySetters|collectionPropertyPolicy|normalizedCollectionWrites/u,
    'event-only use drops property ownership machinery');
  class EventHost {}
  EventHost.immutableEventDetails = ['lr-test'];
  const sourceDetail = { rows: [1, 2] };
  const snapshot = eventOnly.exports.eventCollectionSupport.snapshotEvent(new EventHost(), 'lr-test', sourceDetail);
  assert.notEqual(snapshot, sourceDetail);
  assert.deepEqual(snapshot, sourceDetail);
  assert.ok(Object.isFrozen(snapshot.rows));

  const full = await consume('collectionSupport');
  assert.match(full.code, /installOwnedCollectionAccessors/u);
  class CollectionHost {
    static ownedCollectionProperties = ['rows'];
    static elementProperties = new Map([['rows', {}]]);
    get rows() { return this.stored; }
    set rows(value) { this.stored = value; }
  }
  full.exports.collectionSupport.installProperties(CollectionHost);
  const host = new CollectionHost();
  const rows = [{ value: 1 }];
  host.rows = rows;
  assert.notEqual(host.rows, rows);
  assert.deepEqual(host.rows, rows);
  assert.ok(Object.isFrozen(host.rows[0]));
  rows[0].value = 2;
  assert.equal(host.rows[0].value, 1);

  // Every reviewed construction must remain a plain freeze of inert values. Calls, spreads,
  // getters, computed keys, different members and optional invocation must fail closed.
  const original = published;
  for (const mutation of [
    code => code.replace('Object.freeze({installProperties:installOwnedCollectionAccessors', 'Object.seal({installProperties:installOwnedCollectionAccessors'),
    code => code.replace('installProperties:installOwnedCollectionAccessors', 'installProperties:installOwnedCollectionAccessors()'),
    code => code.replace('installProperties:installOwnedCollectionAccessors', '...{installProperties:installOwnedCollectionAccessors}'),
    code => code.replace('installProperties:installOwnedCollectionAccessors', 'get installProperties(){return installOwnedCollectionAccessors}'),
    code => code.replace('installProperties:installOwnedCollectionAccessors', '["installProperties"]:installOwnedCollectionAccessors'),
    code => code.replace('Object.freeze({installProperties:installOwnedCollectionAccessors', 'Object.freeze?.({installProperties:installOwnedCollectionAccessors'),
    code => 'const Object = globalThis.Object;\n' + code,
    code => 'const { Object } = globalThis;\n' + code,
  ]) {
    const changed = mutation(original);
    assert.notEqual(changed, original, 'adversarial fixture changes the initializer');
    await writeFile(path.join(internal, 'collection-snapshot.js'), changed);
    await assert.rejects(compactBuildJavaScript(collectionFixture), /pure initializer inventory changed/u);
  }
} finally {
  await rm(collectionFixture, { recursive: true, force: true });
}

// A rejected initializer must drain sibling writes before a caller can remove the build tree.
const failedWriteFixture = await mkdtemp(path.join(tmpdir(), 'lyra-compact-failed-write-'));
const originalReadFile = fs.promises.readFile;
const originalWriteFile = fs.promises.writeFile;
let releaseWrite;
let beginWrite;
let finishWrite;
const writeStarted = new Promise(resolve => { beginWrite = resolve; });
const writeReleased = new Promise(resolve => { releaseWrite = resolve; });
const writeFinished = new Promise(resolve => { finishWrite = resolve; });
let compaction;
try {
  const invalid = path.join(failedWriteFixture, 'internal/collection-snapshot.js');
  const sibling = path.join(failedWriteFixture, 'sibling.js');
  await mkdir(path.dirname(invalid));
  await writeFile(invalid, 'export const changedInitializer = true;');
  await writeFile(sibling, 'export const siblingValue = 1;');
  fs.promises.readFile = async (file, ...args) => {
    const source = await originalReadFile(file, ...args);
    if (file === invalid) await writeStarted;
    return source;
  };
  fs.promises.writeFile = async (file, ...args) => {
    if (file !== sibling) return originalWriteFile(file, ...args);
    beginWrite();
    await writeReleased;
    try { return await originalWriteFile(file, ...args); }
    finally { finishWrite(); }
  };
  syncBuiltinESMExports();
  let settled = false;
  compaction = compactBuildJavaScript(failedWriteFixture);
  compaction.then(() => { settled = true; }, () => { settled = true; });
  await writeStarted;
  await setImmediate();
  assert.equal(settled, false, 'compaction waits for the outstanding sibling write before rejecting');
  releaseWrite();
  await assert.rejects(compaction, /pure initializer inventory changed/u);
  await writeFinished;
} finally {
  releaseWrite();
  if (compaction) {
    await compaction.catch(() => {});
    await writeFinished;
  }
  fs.promises.readFile = originalReadFile;
  fs.promises.writeFile = originalWriteFile;
  syncBuiltinESMExports();
  await rm(failedWriteFixture, { recursive: true, force: true });
}

// Only unreachable private module markers are removable; declarations and every runtime route stay.
const pruneFixture = await mkdtemp(path.join(tmpdir(), 'lyra-prune-empty-js-'));
try {
  const dist = path.join(pruneFixture, 'dist');
  await mkdir(path.join(dist, 'patterns/deep'), { recursive: true });
  const protectedNames = ['public', 'condition', 'side-effect', 'main', 'module', 'browser', 'bin', 'package-import', 'static', 'dynamic', 'reexport', 'asset', 'nondot-url', 'require-resolve', 'alias-require', 'patterns/public', 'patterns/deep/public'];
  for (const name of [...protectedNames, 'private']) await writeFile(path.join(dist, `${name}.js`), 'export {};\n');
  await writeFile(path.join(dist, 'private.d.ts'), '/** Retained type contract. */\nexport interface PrivateType {}\n');
  await writeFile(path.join(dist, 'effect.js'), 'globalThis.pruneEffect = 1;\n');
  await writeFile(path.join(dist, 'entry.js'), `
    import './static.js';
    export * from './reexport.js';
    export const load = () => import('./dynamic.js');
    export const asset = new URL('./asset.js', import.meta.url);
    export const nondot = new URL('nondot-url.js', import.meta.url);
    export const requireTarget = require.resolve('./require-resolve.js');
    export const alias = requireFromPackage('./alias-require.js');
  `);
  const manifest = {
    exports: { '.': './dist/public.js', './conditional': { import: './dist/condition.js' }, './patterns/*': './dist/patterns/*.js' },
    imports: { '#private': { default: './dist/package-import.js' } },
    main: 'dist/main.js', module: './dist/module.js', browser: { 'dist/browser.js': false },
    bin: { cli: 'dist/bin.js' }, sideEffects: ['./dist/side-*.js'],
  };
  const result = await pruneEmptyBuildJavaScript(dist, manifest);
  assert.deepEqual(result.removedPaths, ['private.js']);
  for (const name of protectedNames) assert.equal(await readFile(path.join(dist, `${name}.js`), 'utf8'), 'export {};\n', `${name}: protected runtime route`);
  assert.match(await readFile(path.join(dist, 'private.d.ts'), 'utf8'), /Retained type contract/);
  assert.match(await readFile(path.join(dist, 'effect.js'), 'utf8'), /pruneEffect/);
  assert.deepEqual((await pruneEmptyBuildJavaScript(dist, manifest)).removedPaths, [], 'idempotent pruning');

  // Unknown dynamic module names cannot prove an empty file unreachable.
  await writeFile(path.join(dist, 'private.js'), 'export {};\n');
  await writeFile(path.join(dist, 'unknown.js'), 'export const load = name => import(name);\n');
  assert.deepEqual((await pruneEmptyBuildJavaScript(dist, manifest)).removedPaths, []);
  await writeFile(path.join(dist, 'unknown.js'), 'export const asset = name => new URL(name, import.meta.url);\n');
  assert.deepEqual((await pruneEmptyBuildJavaScript(dist, manifest)).removedPaths, []);
  await writeFile(path.join(dist, 'unknown.js'), 'export const load = name => require.resolve(name);\n');
  assert.deepEqual((await pruneEmptyBuildJavaScript(dist, manifest)).removedPaths, []);
  await writeFile(path.join(dist, 'unknown.js'), 'export const validate = name => new URL(name, document.baseURI);\n');
  assert.deepEqual((await pruneEmptyBuildJavaScript(dist, manifest)).removedPaths, ['private.js'], 'ordinary URL validation is not a module loader');
  await writeFile(path.join(dist, 'private.js'), 'export {};\n');
  await rm(path.join(dist, 'unknown.js'));
  assert.deepEqual((await pruneEmptyBuildJavaScript(dist, { ...manifest, sideEffects: true })).removedPaths, []);

  // Parse all modules before removing any; an unsupported/broken module fails closed.
  await writeFile(path.join(dist, 'broken.js'), 'export const = ;');
  await assert.rejects(pruneEmptyBuildJavaScript(dist, manifest), /cannot parse/);
  assert.equal(await readFile(path.join(dist, 'private.js'), 'utf8'), 'export {};\n');
} finally {
  await rm(pruneFixture, { recursive: true, force: true });
}

console.log('published JavaScript compaction test passed.');
