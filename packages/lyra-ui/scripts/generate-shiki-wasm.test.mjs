import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateShikiWasm } from './generate-shiki-wasm.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));

test('WASM artifacts preserve reviewed bytes and notices, and fail closed on source or output drift', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-shiki-wasm-'));
  try {
    const peer = join(directory, 'node_modules', 'shiki');
    const notices = join(directory, 'scripts', 'fixtures', 'shiki-wasm');
    await mkdir(peer, { recursive: true });
    await mkdir(notices, { recursive: true });
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    await writeFile(join(peer, 'package.json'), JSON.stringify({ name: 'shiki', version: '4.5.0', exports: { './package.json': './package.json', './onig.wasm': './onig.wasm' } }));
    await copyFile(require.resolve('shiki/onig.wasm'), join(peer, 'onig.wasm'));
    for (const file of ['LICENSE.vscode-oniguruma.txt', 'NOTICES.vscode-oniguruma.txt']) {
      await copyFile(new URL(`./fixtures/shiki-wasm/${file}`, import.meta.url), join(notices, file));
    }
    await generateShikiWasm(directory);
    await generateShikiWasm(directory, { check: true });
    const output = join(directory, 'dist', 'components', 'conversation', 'code-block');
    for (const file of ['onig.wasm', 'onig.LICENSE.txt', 'onig.provenance.json']) {
      await writeFile(join(output, file), 'changed');
      await assert.rejects(generateShikiWasm(directory, { check: true }), /missing or stale/);
      await generateShikiWasm(directory);
    }
    const license = await readFile(join(output, 'onig.LICENSE.txt'), 'utf8');
    assert.match(license, /Copyright \(c\) Microsoft Corporation/);
    assert.match(license, /Oniguruma LICENSE/);
    await writeFile(join(peer, 'onig.wasm'), 'different binary');
    await assert.rejects(generateShikiWasm(directory), /review engine compatibility and notices/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
