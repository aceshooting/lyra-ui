import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The browser runner cannot resolve the multi-file CommonJS `qrcode` peer, so the real module's
// contract with qr-code-loader.ts and normalizeQrModules() is pinned here under Node instead.
const here = dirname(fileURLToPath(import.meta.url));
const loaderSource = readFileSync(join(here, 'qr-code-loader.ts'), 'utf8');
const classSource = readFileSync(join(here, 'qr-code.class.ts'), 'utf8');

function capability(namespace) {
  if (typeof namespace?.create === 'function') return namespace;
  const fallback = namespace?.default;
  return typeof fallback?.create === 'function' ? fallback : null;
}

test('the loader imports the published qrcode peer and validates its create() capability', () => {
  assert.match(loaderSource, /load: \(\) => import\('qrcode'\)/);
  assert.match(loaderSource, /hasPeerMethods\(value, 'create'\)/);
});

test('the real qrcode module satisfies the capability on its namespace or default export', async () => {
  const api = capability(await import('qrcode'));
  assert.ok(api, 'qrcode exposes create() where resolveOptionalPeerCapability looks for it');
});

test('the real create() result matches the module matrix normalizeQrModules() reads', async () => {
  const api = capability(await import('qrcode'));
  const maxModules = Number(classSource.match(/const MAX_QR_MODULE_COUNT = (\d+);/)?.[1]);
  assert.ok(Number.isSafeInteger(maxModules));
  for (const errorCorrectionLevel of ['L', 'M', 'Q', 'H']) {
    const { modules } = api.create('https://example.com/lyra', { errorCorrectionLevel });
    assert.ok(Number.isSafeInteger(modules.size) && modules.size >= 21 && modules.size <= maxModules);
    assert.equal(typeof modules.get, 'function');
    const values = new Set();
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) values.add(modules.get(row, col));
    }
    for (const value of values) assert.ok([0, 1, true, false].includes(value), `module value ${value}`);
  }
});
