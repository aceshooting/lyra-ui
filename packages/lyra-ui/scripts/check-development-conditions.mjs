import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const requireFromPackage = createRequire(import.meta.url);
const { transformSync } = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'))('esbuild');

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-development-conditions-'));
try {
  mkdirSync(path.join(fixture, 'dist/internal'), { recursive: true });
  writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ type: 'module', imports: pkg.imports }));
  for (const module of ['dev-warning', 'dev-mode-attribute-warning']) {
    for (const suffix of ['', '.development', '.production']) {
      const source = readFileSync(path.join(packageDir, `src/internal/${module}${suffix}.ts`), 'utf8');
      writeFileSync(path.join(fixture, `dist/internal/${module}${suffix}.js`),
        transformSync(source, { loader: 'ts', format: 'esm', target: 'es2022' }).code);
    }
  }
  writeFileSync(path.join(fixture, 'probe.mjs'), `
    import assert from 'node:assert/strict';
    import { devWarn, warnDeprecatedUsage } from './dist/internal/dev-warning.js';
    import { warnUnknownAttributes } from './dist/internal/dev-mode-attribute-warning.js';
    const messages = [];
    globalThis.litIssuedWarnings = new Set();
    console.warn = (message) => messages.push(message);
    devWarn('development probe');
    warnDeprecatedUsage('probe', 'property', 'old', 'new');
    warnUnknownAttributes({ localName: 'lr-probe', getAttributeNames: () => ['typo'] }, []);
    assert.equal(messages.length, process.argv[2] === 'development' ? 3 : 0);
    assert.match(import.meta.resolve('#lyra-dev-warning'), new RegExp('dev-warning\\\\.' + process.argv[2] + '\\\\.js$'));
  `);
  for (const condition of ['production', 'development']) {
    const result = spawnSync(process.execPath, [
      ...(condition === 'development' ? ['--conditions=development'] : []),
      path.join(fixture, 'probe.mjs'), condition,
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${condition} package resolution: ${result.stderr}`);
  }
  console.log('Development conditions: production excludes diagnostics; development retains warnings.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
