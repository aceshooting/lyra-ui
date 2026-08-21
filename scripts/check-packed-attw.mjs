#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readdir, readFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  attwCommandArguments,
  attwEntrypoints,
  parseAttwArguments,
  partitionAttwEntrypoints,
} from './packed-attw.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const uiPackage = join(root, 'packages', 'lyra-ui');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, arguments_, cwd, label) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, arguments_, {
      cwd,
      env: { ...process.env, CI: 'true' },
      stdio: 'inherit',
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${label} failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
      }
    });
  });
}

async function pack(packageDir, destination) {
  const before = new Set((await readdir(destination)).filter((entry) => entry.endsWith('.tgz')));
  await run(pnpm, ['pack', '--pack-destination', destination], packageDir, `packing ${packageDir}`);
  const packed = (await readdir(destination)).filter(
    (entry) => entry.endsWith('.tgz') && !before.has(entry),
  );
  if (packed.length !== 1) {
    throw new Error(`Expected one new package tarball from ${packageDir}, found ${packed.join(', ') || 'none'}`);
  }
  return join(destination, packed[0]);
}

async function main() {
  const { shardIndex, shardTotal, tarball: suppliedTarball } = parseAttwArguments(
    process.argv.slice(2),
  );
  const workspace = suppliedTarball ? undefined : await mkdtemp(join(tmpdir(), 'lr-packed-attw-'));

  try {
    const tarball = suppliedTarball
      ? resolve(process.cwd(), suppliedTarball)
      : await pack(uiPackage, workspace);
    const tarballStat = await stat(tarball);
    if (!tarballStat.isFile()) throw new TypeError(`ATTW tarball is not a file: ${tarball}`);
    // prepack may refresh the explicit exports map, so derive the exhaustive set only after the
    // tarball exists. The source manifest is then the exact manifest pnpm just packed.
    const manifest = JSON.parse(await readFile(join(uiPackage, 'package.json'), 'utf8'));
    const allEntrypoints = attwEntrypoints(manifest);
    const entrypoints = partitionAttwEntrypoints(allEntrypoints, shardIndex, shardTotal);

    console.log(
      `ATTW shard ${shardIndex}/${shardTotal}: checking ${entrypoints.length}/${allEntrypoints.length} typed package exports.`,
    );
    await run(
      pnpm,
      attwCommandArguments(entrypoints, tarball),
      root,
      `Are The Types Wrong package check (shard ${shardIndex}/${shardTotal})`,
    );
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
