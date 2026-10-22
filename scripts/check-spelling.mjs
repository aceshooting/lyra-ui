// Spell-checks the tracked tree with typos (crate-ci/typos). _typos.toml lists the excluded
// generated and multilingual data and the accepted domain terms; fix a real typo rather than
// extending it. Only tracked files count (like check:secrets, check:shell and check:links), so
// untracked scratch files never fail the check; `git add` a new file to have it checked. typos
// walks the directory (a fraction of a second; an explicit file list is twenty times slower) and
// the findings in untracked files are dropped here. Any remaining finding fails the check.

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';
import { capturePinnedTool } from './lib/pinned-tool.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Repository-relative `path` of a typos message (`./a/b.md` and `a/b.md` are the same file). */
const normalize = (path) => path.replace(/^\.\//u, '');

/**
 * One line per typo in a tracked file, from typos' JSON message stream (`--format json`).
 * Binary-file notices, findings in untracked files and blank lines are dropped.
 */
export function trackedFindings(stdout, tracked) {
  return stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line))
    .filter((message) => message.type === 'typo' && tracked.has(normalize(message.path)))
    .map((message) => {
      const where = message.line_num === undefined ? normalize(message.path) : `${normalize(message.path)}:${message.line_num}`;
      return `${where}: error: \`${message.typo}\` should be ${message.corrections.map((fix) => `\`${fix}\``).join(', ')}`;
    });
}

if (isMainModule(import.meta.url)) {
  const tracked = new Set(
    execFileSync('git', ['-c', 'core.quotepath=off', 'ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n')
      .filter(Boolean),
  );
  const { status, stdout } = await capturePinnedTool('typos', ['--format', 'json'], { cwd: ROOT });
  // typos exits 0 without findings and 2 with them; anything else means it did not run.
  if (status !== 0 && status !== 2) {
    process.exitCode = 1;
  } else {
    const findings = trackedFindings(stdout, tracked);
    for (const finding of findings) console.error(finding);
    if (findings.length > 0) console.error(`${findings.length} spelling finding(s) in tracked files.`);
    process.exitCode = findings.length > 0 ? 2 : 0;
  }
}
