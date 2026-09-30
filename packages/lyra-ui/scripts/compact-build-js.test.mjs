import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compactBuildJavaScript } from './compact-build-js.mjs';

const fixture = await mkdtemp(path.join(tmpdir(), 'lyra-compact-js-'));
try {
  const nested = path.join(fixture, 'nested');
  await mkdir(nested);
  await writeFile(
    path.join(nested, 'entry.js'),
    `// duplicate authored prose does not ship in JavaScript\nexport class ReadableName {\n  method(value) { return value + 1; }\n}\nexport const syntaxOnly = true ? 'kept' : 'discarded';\n`,
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
  assert.match(output, /class ReadableName/);
  assert.match(output, /kept/);
  assert.doesNotMatch(output, /discarded/);
  assert.doesNotMatch(output, /true\s*\?/);
  const stringsOutput = await readFile(path.join(nested, 'strings.js'), 'utf8');
  assert.match(stringsOutput, /\u0644\u0627 \u062a\u0648\u062c\u062f/u, 'non-ASCII text ships as UTF-8');
  assert.match(stringsOutput, /\u2026/u);
  assert.doesNotMatch(stringsOutput, /\\u[0-9a-fA-F]{4}/u, 'no `\\uXXXX` escapes for printable characters');
  const cliOutput = await readFile(path.join(nested, 'cli.mjs'), 'utf8');
  assert.doesNotMatch(cliOutput, /copied public executables/);
  assert.ok(cliOutput.length < 70);
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
  assert.equal(after.publicBootstrap.name, 'publicBootstrap');
  assert.equal(after.preservedLabel, 'Résumé 🦉');
  assert.equal(Function('return ' + compressed)(), 15);
  assert.equal(Function('return ' + after.publicBootstrap(-1))(), 0);
  assert.match(await readFile(path.join(themeDirectory, 'style-ownership.js'), 'utf8'),
    /function readStyleOwnership\(/u);
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
} finally {
  await rm(bootstrapFixture, { recursive: true, force: true });
}

console.log('published JavaScript compaction test passed.');
