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
    `// duplicate authored prose does not ship in JavaScript\nexport class ReadableName {\n  method(value) { return value + 1; }\n}\n`,
  );
  await writeFile(path.join(nested, 'entry.d.ts'), '/** IDE documentation stays. */\nexport class ReadableName {}\n');
  const result = await compactBuildJavaScript(fixture);
  assert.equal(result.files, 1);
  assert.ok(result.afterBytes < result.beforeBytes);
  const output = await readFile(path.join(nested, 'entry.js'), 'utf8');
  assert.doesNotMatch(output, /duplicate authored prose|sourceMappingURL/);
  assert.match(output, /class ReadableName/);
  assert.match(await readFile(path.join(nested, 'entry.d.ts'), 'utf8'), /IDE documentation stays/);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

console.log('published JavaScript compaction test passed.');
