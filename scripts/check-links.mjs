// Checks the links of every tracked Markdown file with lychee. The default run is offline (see
// lychee.toml): relative links, root-relative links and heading fragments must resolve, which
// costs well under a second. `--external` also requests every http(s) URL; it needs the network and
// is run by .github/workflows/external-links.yml, never per push. Any broken link fails the check.

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';
import { runPinnedTool } from './lib/pinned-tool.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Remote links: tolerate rate limiting and slow hosts, and check pages rather than their fragments.
const EXTERNAL_ARGS = Object.freeze([
  '--offline=false',
  '--include-fragments=none',
  '--max-retries', '3',
  '--retry-wait-time', '5',
  '--timeout', '30',
  '--accept', '100..=103,200..=299,429',
]);

function trackedMarkdown(root = ROOT) {
  return execFileSync('git', ['ls-files', '*.md'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
}

export function lycheeArgs({ external = false, root = ROOT } = {}) {
  return ['--config', 'lychee.toml', '--root-dir', root, ...(external ? EXTERNAL_ARGS : []), '--files-from', '-'];
}

if (isMainModule(import.meta.url)) {
  const external = process.argv.includes('--external');
  process.exitCode = await runPinnedTool('lychee', lycheeArgs({ external }), {
    cwd: ROOT,
    input: `${trackedMarkdown().join('\n')}\n`,
  });
}
