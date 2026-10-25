import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageScripts } from '../../../scripts/lib/coverage/staged-script.mjs';

export const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

export function put(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/**
 * A scratch package root holding a staged copy of one maintenance script, so the script runs against
 * fixture flags instead of the shipped ones (every script locates `flags/` from its own path). The
 * script's dependencies resolve through a link to this package's `node_modules`.
 */
export function scratchPackage(context, script) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-flags-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'flags'));
  symlinkSync(join(packageDir, 'node_modules'), join(root, 'node_modules'), 'junction');
  const [staged] = stageScripts({ from: packageDir, to: root, files: [`scripts/${script}`] });
  return {
    root,
    flags: join(root, 'flags'),
    run: () => spawnSync(process.execPath, [staged], { encoding: 'utf8' }),
  };
}
