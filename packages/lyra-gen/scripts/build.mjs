import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

export const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function runCommand(command, args, directory) {
  const result = spawnSync(command, args, { cwd: directory, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}`);
}

/** Remove only this package's emitted output before compiling, then verify the emitted boundary. */
export function buildPackage(directory = packageDirectory, { run = runCommand, check = cwd => runCommand(process.execPath, ['scripts/check-build-artifacts.mjs'], cwd) } = {}) {
  rmSync(join(directory, 'dist'), { recursive: true, force: true });
  run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], directory);
  const outputDirectory = join(directory, 'dist');
  for (const file of readdirSync(outputDirectory, { recursive: true })) {
    if (!file.endsWith('.js')) continue;
    const path = join(outputDirectory, file);
    const { code } = transformSync(readFileSync(path, 'utf8'), { target: 'es2022', legalComments: 'inline' });
    writeFileSync(path, code);
  }
  check(directory);
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) buildPackage();
