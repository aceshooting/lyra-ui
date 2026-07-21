// Scans every git-tracked file for committed credentials (API keys, tokens, private keys, ...)
// using secretlint's recommended ruleset, and fails the build if any are found. Tracked files are
// exactly what could be published/leaked, and scanning them (rather than a `**/*` glob) skips
// node_modules/dist and keeps the run fast. Config lives in .secretlintrc.json.
//
// This guards against accidentally committing a live credential -- complementary to
// check-source-policy.mjs (which guards against internal process/client names reaching the tarball)
// and to the org's Scorecard/CodeQL scans. It checks the working tree, not git history.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bin = resolve(ROOT, 'node_modules/.bin/secretlint');
if (!existsSync(bin)) {
  console.error('secretlint is not installed (expected node_modules/.bin/secretlint). Run `pnpm install`.');
  process.exit(1);
}

const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const BATCH = 400; // keep well under ARG_MAX while amortizing per-invocation startup
let failed = false;
for (let i = 0; i < files.length; i += BATCH) {
  try {
    execFileSync(bin, files.slice(i, i + BATCH), { cwd: ROOT, stdio: 'inherit' });
  } catch {
    failed = true; // secretlint exits non-zero when it reports a finding; keep scanning the rest
  }
}

if (failed) {
  console.error('\nSecret scan FAILED: secretlint reported potential credentials above.');
  process.exit(1);
}
console.log(`Secret scan passed: ${files.length} tracked files, no secrets detected.`);
