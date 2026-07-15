import { cp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const tsc = join(
  packageDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

await rm(join(packageDir, 'dist'), { recursive: true, force: true });

await new Promise((resolve, reject) => {
  const child = spawn(tsc, ['-p', join(packageDir, 'tsconfig.json')], {
    cwd: packageDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`tsc failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
  });
});

await cp(join(packageDir, 'src', 'theme.css'), join(packageDir, 'dist', 'theme.css'));
