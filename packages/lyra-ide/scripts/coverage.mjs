// Runs this package's `test` script under native V8 coverage and reports its original sources.
//
// Scope rule: `scripts/sync.mjs`, `scripts/check-package.mjs` and this runner are the package's original
// code. Tests are excluded. The editor data files are JSON copied from lyra-ui by `sync` and are not
// JavaScript, so they never enter the census. Every other JavaScript file must be classified here, so a
// new script cannot silently leave the report.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNodeCoverage } from '../../lyra-docs/scripts/lib/node-coverage.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SCOPE = Object.freeze({
  label: '@aceshooting/lyra-ide',
  floor: 100,
  include: ['scripts/check-package.mjs', 'scripts/coverage.mjs', 'scripts/sync.mjs'],
  exclude: [{ pattern: /\.test\.mjs$/u, reason: 'test' }],
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = (await runNodeCoverage({ root: ROOT, ...SCOPE })).exitCode;
}
