import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';

// Reviewed vscode-oniguruma 1.7.0 binary shipped unchanged by Shiki 4.4.3 and 4.5.0.
// A different binary requires compatibility and attribution review before updating this value.
const reviewedSha256 = 'fd885c2d12e5951e59d761ebd4a006e06254b1491fd6f530c92b69fb4d8d77d9';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function generateShikiWasm(packageDir, { check = false } = {}) {
  const require = createRequire(join(packageDir, 'package.json'));
  const manifest = JSON.parse(await readFile(require.resolve('shiki/package.json'), 'utf8'));
  const binary = await readFile(require.resolve('shiki/onig.wasm'));
  assert.equal(hash(binary), reviewedSha256, 'Shiki WASM changed: review engine compatibility and notices before updating the approved binary hash');
  const noticesDir = join(packageDir, 'scripts', 'fixtures', 'shiki-wasm');
  const notices = await Promise.all(['LICENSE.vscode-oniguruma.txt', 'NOTICES.vscode-oniguruma.txt']
    .map(name => readFile(join(noticesDir, name), 'utf8')));
  const outputs = new Map([
    ['onig.wasm', binary],
    ['onig.LICENSE.txt', Buffer.from(notices.join('\n'))],
    ['onig.provenance.json', Buffer.from(JSON.stringify({
      source: 'shiki/onig.wasm', sourceVersion: manifest.version,
      upstream: 'vscode-oniguruma@1.7.0', sha256: reviewedSha256,
      bytes: binary.length, notices: 'onig.LICENSE.txt',
    }, null, 2) + '\n')],
  ]);
  const destination = join(packageDir, 'dist', 'components', 'conversation', 'code-block');
  if (!check) await mkdir(destination, { recursive: true });
  for (const [name, expected] of outputs) {
    const path = join(destination, name);
    if (check) assert.ok((await readFile(path)).equals(expected), `${name} is missing or stale; regenerate the reviewed Shiki WASM artifacts`);
    else await writeFile(path, expected);
  }
  return { bytes: binary.length, sha256: reviewedSha256, sourceVersion: manifest.version };
}

if (isMainModule(import.meta.url)) {
  const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
  await generateShikiWasm(packageDir, { check: process.argv.includes('--check') });
}
