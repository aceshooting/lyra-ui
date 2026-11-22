#!/usr/bin/env node
// Pack prepared companions as CI does and check each archive against the hard size ceilings.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sizeChecker = 'packages/lyra-ui/scripts/check-package-size.mjs';
const UI = { name: '@aceshooting/lyra-ui', directory: 'packages/lyra-ui' };
const COMPANIONS = [
  { name: '@aceshooting/lyra-translations', directory: 'packages/lyra-translations', prepare: 'assemble' },
  { name: '@aceshooting/lyra-ide', directory: 'packages/lyra-ide', prepare: 'sync' },
  { name: '@aceshooting/lyra-map', directory: 'packages/lyra-map', prepare: 'build' },
  { name: '@aceshooting/lyra-3d', directory: 'packages/lyra-3d', prepare: 'build' },
  { name: '@aceshooting/lyra-gen', directory: 'packages/lyra-gen', prepare: 'build' },
  { name: '@aceshooting/lyra-cdn', directory: 'packages/lyra-cdn', prepare: 'build' },
];

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${result.status ?? result.signal}`);
}

function checkArchive({ name, directory, prepare }, destination) {
  const packOptions = [];
  if (prepare) {
    run('pnpm', ['--filter', name, prepare]);
    packOptions.push('--config.ignore-scripts=true');
  }
  run('pnpm', [...packOptions, 'pack', '--pack-destination', destination], resolve(root, directory));
  const prefix = `${name.replace('@', '').replace('/', '-')}-`;
  const archives = readdirSync(destination).filter(file => file.startsWith(prefix) && file.endsWith('.tgz'));
  if (archives.length !== 1) throw new Error(`${name}: expected exactly one archive from pnpm pack`);
  const options = prepare ? ['--package', name] : [];
  run(process.execPath, [sizeChecker, ...options, '--tarball', join(destination, archives[0])]);
}

const args = process.argv.slice(2);
const includeUi = args.length === 1 && args[0] === '--include-ui';
if (args.length && !includeUi) throw new Error('Usage: node scripts/check-companion-package-sizes.mjs [--include-ui]');
const destination = mkdtempSync(join(tmpdir(), 'lyra-package-sizes-'));
let failed = false;
function attempt(operation) {
  try {
    operation();
  } catch (error) {
    failed = true;
    console.error(error instanceof Error ? error.message : String(error));
  }
}
try {
  if (includeUi) {
    attempt(() => run(process.execPath, [sizeChecker]));
    attempt(() => checkArchive(UI, destination));
  }
  for (const companion of COMPANIONS) attempt(() => checkArchive(companion, destination));
} finally {
  rmSync(destination, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
