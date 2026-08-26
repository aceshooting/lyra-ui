import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
  const result = await compactBuildJavaScript(fixture);
  assert.equal(result.files, 2);
  assert.ok(result.afterBytes < result.beforeBytes);
  const output = await readFile(path.join(nested, 'entry.js'), 'utf8');
  assert.doesNotMatch(output, /duplicate authored prose|sourceMappingURL/);
  assert.match(output, /class ReadableName/);
  assert.match(output, /kept/);
  assert.doesNotMatch(output, /discarded/);
  assert.doesNotMatch(output, /true\s*\?/);
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

console.log('published JavaScript compaction test passed.');
