#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  attwCommandArguments,
  validatePackedAttwManifest,
  parseAttwArguments,
  partitionAttwEntrypoints,
} from './packed-attw.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const uiPackage = join(root, 'packages', 'lyra-ui');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, arguments_, cwd, label, { buffered = false } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, arguments_, {
      cwd,
      env: { ...process.env, CI: 'true' },
      stdio: buffered ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    const output = [];
    if (buffered) {
      child.stdout.on('data', (chunk) => output.push(chunk));
      child.stderr.on('data', (chunk) => output.push(chunk));
    }
    child.once('error', rejectRun);
    child.once('close', (code, signal) => {
      const text = Buffer.concat(output).toString('utf8');
      if (code === 0) {
        resolveRun(text);
      } else {
        const error = new Error(`${label} failed${signal ? ` (${signal})` : ` with exit code ${code}`}`);
        error.output = text;
        rejectRun(error);
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
  const { shardIndex, shardTotal, tarball: suppliedTarball, workers } = parseAttwArguments(
    process.argv.slice(2),
  );
  const workspace = suppliedTarball ? undefined : await mkdtemp(join(tmpdir(), 'lr-packed-attw-'));

  try {
    const tarball = suppliedTarball
      ? resolve(process.cwd(), suppliedTarball)
      : await pack(uiPackage, workspace);
    const tarballStat = await stat(tarball);
    if (!tarballStat.isFile()) throw new TypeError(`ATTW tarball is not a file: ${tarball}`);
    // Read after prepack, which can refresh exports. A supplied artifact must describe exactly
    // this checkout too; never silently choose its checked routes from a different manifest.
    const manifest = JSON.parse(await readFile(join(uiPackage, 'package.json'), 'utf8'));
    const packedManifest = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json'], {
      encoding: 'utf8', maxBuffer: 1024 * 1024,
    }));
    const allEntrypoints = validatePackedAttwManifest(packedManifest, manifest);
    const sha256 = createHash('sha256').update(await readFile(tarball)).digest('hex');
    console.log(`ATTW package SHA-256: ${sha256}`);
    const entrypoints = partitionAttwEntrypoints(allEntrypoints, shardIndex, shardTotal);

    console.log(
      `ATTW shard ${shardIndex}/${shardTotal}: checking ${entrypoints.length}/${allEntrypoints.length} typed package exports` +
        (workers > 1 ? ` with ${workers} concurrent workers.` : '.'),
    );
    if (workers === 1) {
      await run(
        pnpm,
        attwCommandArguments(entrypoints, tarball),
        root,
        `Are The Types Wrong package check (shard ${shardIndex}/${shardTotal})`,
      );
      return;
    }
    // The same disjoint round-robin partition, once more inside this shard.
    const results = await Promise.allSettled(
      Array.from({ length: workers }, (_, index) => {
        const worker = index + 1;
        const label = `Are The Types Wrong package check (shard ${shardIndex}/${shardTotal}, worker ${worker}/${workers})`;
        return run(
          pnpm,
          attwCommandArguments(partitionAttwEntrypoints(entrypoints, worker, workers), tarball),
          root,
          label,
          { buffered: true },
        ).then((output) => ({ label, output }));
      }),
    );
    const failures = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        console.log(`--- ${result.value.label}\n${result.value.output}`);
      } else {
        console.error(`--- ${result.reason.message}\n${result.reason.output ?? ''}`);
        failures.push(result.reason.message);
      }
    }
    if (failures.length > 0) throw new Error(failures.join('\n'));
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
