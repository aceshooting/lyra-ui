import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';
import { walk } from './lib/fs-walk.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Lists the Node-run documentation pin suites under src/. */
export function findDocsPinSuites(root = packageRoot) {
  return walk(path.join(root, 'src'))
    .filter((file) => file.endsWith('.docs.test.mjs'))
    .sort();
}

if (isMainModule(import.meta.url)) {
  const suites = findDocsPinSuites();
  if (suites.length === 0) {
    console.error('No *.docs.test.mjs suites found under src/: the documentation pins are not running.');
    process.exit(1);
  }
  const result = spawnSync(process.execPath, ['--test', ...suites], { cwd: packageRoot, stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
