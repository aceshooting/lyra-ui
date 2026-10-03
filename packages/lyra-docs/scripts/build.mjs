import { execFileSync } from 'node:child_process';
import { copyFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });
rmSync(new URL('../.test-output', import.meta.url), { recursive: true, force: true });
execFileSync('tsc', ['-p', 'tsconfig.build.json'], { stdio: 'inherit' });
const require = createRequire(import.meta.url);
copyFileSync(require.resolve('@docx-editor.dev/core/styles/editor.css'), new URL('../dist/docx/editor.css', import.meta.url));
await import('./check-package.mjs');
