import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareModelAsset } from '../dist/model/model-asset.js';
import { glbWithImage, png } from './model-fixtures.mjs';

test('cancellation after an awaited image decode closes the returned image and all candidate leases', async () => {
  const controller = new AbortController(), live = new Set(); let serial = 0, closed = 0;
  const budget = { reserve() { const key = `buffer-${serial++}`; live.add(key); let released = false;
    return { key, release() { if (!released) { released = true; live.delete(key); } } }; }, admitCounts() {}, noteNativeImage() {} };
  await assert.rejects(prepareModelAsset({ format: 'glb', bytes: glbWithImage(png(), 'image/png') },
    { execution: 'local', budget, signal: controller.signal }, { async decodeImage() {
      controller.abort(); return { width: 1, height: 1, close() { closed++; } };
    } }), { name: 'AbortError' });
  assert.equal(closed, 1); assert.equal(live.size, 0);
});

test('image dimension refusal closes partially accepted images without producing an asset', async () => {
  let closed = 0, active = 0;
  const budget = { reserve() { active++; let released = false; return { key: `buffer-${active}`,
    release() { if (!released) { released = true; active--; } } }; }, admitCounts() {}, noteNativeImage() {} };
  await assert.rejects(prepareModelAsset({ format: 'glb', bytes: glbWithImage(png(), 'image/png') },
    { execution: 'local', budget }, { async decodeImage() { return { width: 2, height: 1, close() { closed++; } }; } }));
  assert.equal(closed, 1); assert.equal(active, 0);
});

test('a later image decoder failure closes every already accepted bitmap', async () => {
  let decoded = 0, closed = 0, active = 0;
  const budget = { reserve() { const key = `buffer-${++active}`; let released = false;
    return { key, release() { if (!released) { released = true; active--; } } }; }, admitCounts() {}, noteNativeImage() {} };
  const bytes = glbWithImage(png(), 'image/png', document => { document.images.push({ ...document.images[0] }); });
  await assert.rejects(prepareModelAsset({ format: 'glb', bytes }, { execution: 'local', budget }, {
    async decodeImage() { if (++decoded === 2) throw new Error('Image decode refused');
      return { width: 1, height: 1, close() { closed++; } }; }
  }));
  assert.equal(decoded, 2); assert.equal(closed, 1); assert.equal(active, 0);
});
