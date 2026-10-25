import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNodeCoverage } from './lib/coverage/node-coverage.mjs';

// Relocated shared tooling has its own complete source census and line/statement floor.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await runNodeCoverage({
  root, label: 'shared coverage tooling', floor: 100, script: 'test:coverage-tooling:unit',
  directories: ['scripts/lib/coverage'],
  include: ['scripts/lib/coverage/node-coverage.mjs', 'scripts/lib/coverage/staged-script.mjs', 'scripts/lib/coverage/libraries.mjs'],
  exclude: [{ pattern: /^scripts\/lib\/coverage\/.*\.test\.mjs$/u, reason: 'test' }],
});
process.exitCode = result.exitCode;
