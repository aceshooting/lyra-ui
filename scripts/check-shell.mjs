// Lints every tracked shell script with shellcheck: files named *.sh or *.bash, plus extensionless
// files that start with an sh or bash shebang (git hooks, wrappers). Any finding fails the check;
// a justified exception is an inline `# shellcheck disable=SCxxxx` with its reason beside it.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';
import { runPinnedTool } from './lib/pinned-tool.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SHELL_SHEBANG = /^#!\s*(?:\/usr\/bin\/env\s+(?:-S\s+)?)?(?:\S*\/)?(?:ba|da|k|z)?sh\b/u;

/** Tracked shell scripts, repository-relative and sorted. */
export function shellScripts(root = ROOT) {
  const tracked = (args) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    } catch (error) {
      if (error.status === 1) return []; // `git grep` exits 1 when nothing matches
      throw error;
    }
  };
  const named = tracked(['ls-files', '-z', '*.sh', '*.bash']);
  // Cheap pre-filter: only files with a line starting `#!` can have a shebang.
  const withShebangLine = tracked(['grep', '-l', '-I', '-z', '-e', '^#!', '--', '.']);
  const shebang = withShebangLine.filter((file) => {
    try {
      return SHELL_SHEBANG.test(readFileSync(join(root, file), 'utf8').split('\n', 1)[0]);
    } catch {
      return false;
    }
  });
  return [...new Set([...named, ...shebang])].sort();
}

if (isMainModule(import.meta.url)) {
  const scripts = shellScripts();
  console.error(`shellcheck: ${scripts.length} tracked shell scripts`);
  process.exitCode = await runPinnedTool('shellcheck', ['--external-sources', ...scripts], { cwd: ROOT });
}
