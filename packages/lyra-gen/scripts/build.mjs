import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkGenBuildArtifacts } from './check-build-artifacts.mjs';

export const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function runCommand(command, args, directory) {
  const result = spawnSync(command, args, { cwd: directory, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}`);
}

/** Remove only this package's emitted output before compiling, then verify the emitted boundary. */
export function buildPackage(directory = packageDirectory, { run = runCommand, check = checkGenBuildArtifacts } = {}) {
  rmSync(join(directory, 'dist'), { recursive: true, force: true });
  run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], directory);
  check(directory);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildPackage();
