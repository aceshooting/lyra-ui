// Runs this package's `test` script under native V8 coverage and reports its original sources.
//
// Scope rule: `scripts/build.mjs` (the assembler), `scripts/check-package.mjs` (the package contract) and
// this runner are the package's original code. Tests are excluded. `dist/` is the assembled output of
// build.mjs: catalog modules authored in lyra-ui and retargeted at the public localization entry, so it is
// generated and never measured here. The catalog helpers in lyra-ui's scripts belong to lyra-ui, which
// measures them. Every other JavaScript file must be classified here, so a new script cannot silently
// leave the report.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNodeCoverage } from '../../../scripts/lib/coverage/node-coverage.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SCOPE = Object.freeze({
  label: '@aceshooting/lyra-translations',
  floor: 100,
  include: ['scripts/build.mjs', 'scripts/check-package.mjs', 'scripts/coverage.mjs'],
  exclude: [
    { pattern: /\.test\.mjs$/u, reason: 'test' },
    { pattern: /^dist\//u, reason: 'assembled output of scripts/build.mjs: catalogs generated from lyra-ui' },
  ],
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = (await runNodeCoverage({ root: ROOT, ...SCOPE })).exitCode;
}
