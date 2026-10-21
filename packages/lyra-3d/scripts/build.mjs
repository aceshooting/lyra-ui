import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
rmSync(path.join(root, 'dist'), { recursive: true, force: true });
// ESM and declarations straight from the sources; `three` stays an external dependency so an
// application that also uses it resolves a single copy.
execFileSync('tsc', ['-p', 'tsconfig.json'], { cwd: root, stdio: 'inherit' });
await import('./check-package.mjs');
