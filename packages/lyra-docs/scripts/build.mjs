import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactBuildJavaScript, pruneEmptyBuildJavaScript } from '../../lyra-ui/scripts/compact-build-js.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
rmSync(path.join(root, '.test-output'), { recursive: true, force: true });
execFileSync('tsc', ['-p', 'tsconfig.build.json'], { cwd: root, stdio: 'inherit' });
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
await compactBuildJavaScript(dist);
await pruneEmptyBuildJavaScript(dist, manifest);
// Deep imports are blocked by the export map, so declarations no public entry reaches never ship.
const reachable = new Set();
const visit = file => {
  if (reachable.has(file) || !existsSync(file)) return;
  reachable.add(file);
  for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/(?:from|import\()\s*['"](\.[^'"]+)\.js['"]/gu))
    visit(path.resolve(path.dirname(file), `${specifier}.d.ts`));
};
for (const route of Object.values(manifest.exports)) if (route.types) visit(path.join(root, route.types));
for (const file of readdirSync(dist, { recursive: true }))
  if (file.endsWith('.d.ts') && !reachable.has(path.join(dist, file))) rmSync(path.join(dist, file));
const require = createRequire(import.meta.url);
copyFileSync(require.resolve('@docx-editor.dev/core/styles/editor.css'), path.join(dist, 'docx/editor.css'));
await import('./check-package.mjs');
