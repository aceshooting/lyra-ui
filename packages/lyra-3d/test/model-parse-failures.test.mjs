import assert from 'node:assert/strict';
import test from 'node:test';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { parseModel } from '../dist/model/model-parsers.js';
import { glbWithImage, jpeg, png } from './model-fixtures.mjs';

/** Replaces the globals the glTF image path needs for one test. */
function withImageDecoder(t, decode) {
  const names = ['createImageBitmap', 'self'];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, writable: true, value: decode });
  Object.defineProperty(globalThis, 'self', { configurable: true, writable: true, value: globalThis });
  t.after(() => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
}

test('an image that passed header admission but cannot be decoded fails closed as invalid', async (t) => {
  withImageDecoder(t, async () => { throw new Error('The source image could not be decoded.'); });
  await assert.rejects(parseModel(admitModel(glbWithImage(png(), 'image/png'), 'glb')), (error) => error instanceof ModelAdmissionError && error.code === 'invalid');
});

test('buffer-view images decode once, reach the material and close with the model', async (t) => {
  let closed = 0;
  const decoded = [];
  withImageDecoder(t, async (blob) => { decoded.push(blob.type); return { width: 1, height: 1, close() { closed += 1; } }; });
  for (const [bytes, mime] of [[png(), 'image/png'], [jpeg(), 'image/jpeg']]) {
    decoded.length = 0; closed = 0;
    const parsed = await parseModel(admitModel(glbWithImage(bytes, mime), 'glb'));
    let map;
    parsed.object.traverse((object) => { if (object.material?.map) map = object.material.map; });
    assert.ok(map, 'the base colour texture was loaded from the packed image');
    assert.deepEqual(decoded, [mime]);
    assert.equal(closed, 0, 'the bitmap stays open while the model lives');
    parsed.dispose();
    parsed.dispose();
    assert.equal(closed, 1);
  }
});
