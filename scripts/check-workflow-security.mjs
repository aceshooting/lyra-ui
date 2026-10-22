// Audits .github/workflows with zizmor: offline (no token, no network after the pinned binary is
// cached) and with the default persona. .github/zizmor.yml holds the reviewed exceptions. Any
// finding fails the check (zizmor exits 11-14 when it reports one).
//
// Complements scripts/check-workflows.sh (actionlint: syntax, expression types, shell in steps).

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';
import { runPinnedTool } from './lib/pinned-tool.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const ZIZMOR_ARGS = Object.freeze(['--offline', '--quiet', '--no-progress', '.github/workflows']);

if (isMainModule(import.meta.url)) {
  process.exitCode = await runPinnedTool('zizmor', ZIZMOR_ARGS, { cwd: ROOT });
}
