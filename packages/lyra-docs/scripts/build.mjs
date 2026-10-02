import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });
rmSync(new URL('../.test-output', import.meta.url), { recursive: true, force: true });
execFileSync('tsc', ['-p', 'tsconfig.build.json'], { stdio: 'inherit' });
await import('./check-package.mjs');
