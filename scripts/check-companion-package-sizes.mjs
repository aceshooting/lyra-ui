#!/usr/bin/env node
// Packs the companions released with lyra-ui exactly as CI's packed-consumer job does and checks
// each archive against its package-budgets.json ceilings, so `pnpm release:budgets` catches a
// version-stamped changelog that outgrows a companion ceiling before the release commit.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COMPANIONS = [
  { name: '@aceshooting/lyra-translations', directory: 'packages/lyra-translations', prepare: 'assemble' },
  { name: '@aceshooting/lyra-ide', directory: 'packages/lyra-ide', prepare: 'sync' },
  { name: '@aceshooting/lyra-map', directory: 'packages/lyra-map', prepare: 'build' },
  { name: '@aceshooting/lyra-3d', directory: 'packages/lyra-3d', prepare: 'build' },
  { name: '@aceshooting/lyra-gen', directory: 'packages/lyra-gen', prepare: 'build' },
];

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status ?? result.signal}`);
}

const destination = mkdtempSync(join(tmpdir(), 'lyra-companion-sizes-'));
let failed = false;
try {
  for (const { name, directory, prepare } of COMPANIONS) {
    run('pnpm', ['--filter', name, prepare]);
    run('pnpm', ['pack', '--ignore-scripts', '--pack-destination', destination], resolve(root, directory));
    const prefix = `${name.replace('@', '').replace('/', '-')}-`;
    const tarball = readdirSync(destination).find((file) => file.startsWith(prefix) && file.endsWith('.tgz'));
    if (!tarball) throw new Error(`${name}: pnpm pack produced no tarball`);
    const check = spawnSync(process.execPath, [
      'packages/lyra-ui/scripts/check-package-size.mjs', '--package', name, '--tarball', join(destination, tarball),
    ], { cwd: root, stdio: 'inherit' });
    // Check every companion before failing so one run reports all overruns.
    if (check.status !== 0) failed = true;
  }
} finally {
  rmSync(destination, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
