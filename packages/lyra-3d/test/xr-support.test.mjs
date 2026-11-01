import assert from 'node:assert/strict';
import test from 'node:test';

async function environment(values, run) {
  const previous = new Map(['navigator', 'isSecureContext'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  try {
    for (const name of previous.keys()) {
      if (Object.hasOwn(values, name)) Object.defineProperty(globalThis, name, { configurable: true, ...values[name] });
      else delete globalThis[name];
    }
    return await run();
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  }
}

test('importing XR support does not inspect browser globals', async () => {
  let reads = 0;
  await environment({ navigator: { get() { reads++; throw new Error('unexpected navigator read'); } },
    isSecureContext: { get() { reads++; throw new Error('unexpected security read'); } } }, async () => {
    const module = await import('../dist/xr/support.js');
    assert.equal(typeof module.isLyra3dXrSupported, 'function'); assert.equal(reads, 0);
  });
});

test('support is false for SSR, insecure context and unavailable or malformed capability', async () => {
  const { isLyra3dXrSupported } = await import('../dist/xr/support.js');
  await environment({}, async () => assert.equal(await isLyra3dXrSupported(), false));
  for (const secure of [false, true]) for (const xr of [undefined, null, {}, { isSessionSupported: 3 }]) {
    await environment({ navigator: { value: { xr } }, isSecureContext: { value: secure } }, async () => assert.equal(await isLyra3dXrSupported(), false));
  }
  let queries = 0;
  await environment({ navigator: { value: { xr: { isSessionSupported() { queries++; return Promise.resolve(true); } } } },
    isSecureContext: { value: false } }, async () => assert.equal(await isLyra3dXrSupported(), false));
  assert.equal(queries, 0);
});

test('support preserves native receiver and only accepts a true immersive-vr query result', async () => {
  const { isLyra3dXrSupported } = await import('../dist/xr/support.js');
  for (const outcome of [true, false, 'true', undefined, 'reject', 'throw']) {
    let requests = 0, queries = 0;
    const xr = { requestSession() { requests++; throw new Error('support must not enter'); },
      isSessionSupported(mode) {
        assert.equal(this, xr); assert.equal(mode, 'immersive-vr'); queries++;
        if (outcome === 'throw') throw new Error('private platform detail');
        return outcome === 'reject' ? Promise.reject(new Error('private platform detail')) : Promise.resolve(outcome);
      } };
    await environment({ navigator: { value: { xr } }, isSecureContext: { value: true } }, async () => assert.equal(await isLyra3dXrSupported(), outcome === true));
    assert.equal(queries, 1); assert.equal(requests, 0);
  }
});
