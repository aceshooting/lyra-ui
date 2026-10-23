import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CODECOV_PACKAGES, normalizeLcov } from './prepare-codecov-lcov.mjs';

// Use the package that declares fast-check; root tooling does not declare a second installation.
const fc = createRequire(new URL('../packages/lyra-ui/package.json', import.meta.url))('fast-check');

test('source qualification preserves arbitrary valid LCOV counters and line endings', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-codecov-property-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of CODECOV_PACKAGES) {
    const directory = join(root, 'packages', name, 'scripts');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'check-package.mjs'), 'export {};\n');
  }
  fc.assert(fc.property(
    fc.constantFrom(...CODECOV_PACKAGES),
    fc.array(fc.nat({ max: 10_000 }), { minLength: 1, maxLength: 20 }),
    fc.boolean(), fc.constantFrom('', './'),
    (packageName, hits, crlf, prefix) => {
      const newline = crlf ? '\r\n' : '\n';
      const path = 'scripts/check-package.mjs';
      const lines = hits.map((count, index) => `DA:${index + 1},${count}`);
      const input = [`SF:${prefix}${path}`, ...lines, `LF:${hits.length}`,
        `LH:${hits.filter((count) => count > 0).length}`, 'end_of_record', ''].join(newline);
      const output = normalizeLcov(input, { packageName, repositoryRoot: root });
      assert.equal(output, input.replace(`SF:${prefix}${path}`, `SF:packages/${packageName}/${path}`));
      assert.equal(normalizeLcov(output, { packageName, repositoryRoot: root }), output);
    },
  ), { seed: 0x5eed_1e57, numRuns: 200 });
});
