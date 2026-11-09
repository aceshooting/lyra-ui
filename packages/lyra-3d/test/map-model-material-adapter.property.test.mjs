import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { validateModelMaterialChannels } from '../dist/map/model-material-adapter.js';
import { fixture } from './map-model-material-fixture.mjs';

const runs = { seed: 0x5eed_3d72, numRuns: 200, includeErrorInReport: true };

test('finite material fractions admit exactly the closed unit interval without mutating input', () => {
  fc.assert(fc.property(fc.constantFrom('opacity', 'alphaTest', 'metalness', 'roughness'),
    fc.oneof(fc.double({ noNaN: true, noDefaultInfinity: true }), fc.constantFrom(Number.NaN, Infinity, -Infinity, 0, 1)),
    (field, value) => {
      const input = fixture(); input.material[field] = value;
      const before = structuredClone(input);
      if (Number.isFinite(value) && value >= 0 && value <= 1) {
        const profile = validateModelMaterialChannels(input);
        assert.equal(profile.coverage, input.material.alphaTest > 0 ? 'mask' : 'opaque');
      } else assert.throws(() => validateModelMaterialChannels(input), TypeError);
      assert.deepEqual(input, before);
    }), runs);
});

test('normalized integer normal channels preserve nonzero vectors across channel widths and strides', () => {
  fc.assert(fc.property(fc.constantFrom('Int8Array', 'Int16Array', 'Uint8Array', 'Uint16Array'),
    fc.integer({ min: 1, max: 127 }), fc.integer({ min: 3, max: 12 }), (kind, magnitude, stride) => {
      const input = fixture(), ArrayType = globalThis[kind];
      const values = new ArrayType(stride * 3);
      for (let row = 0; row < 3; row++) values[row * stride + 2] = magnitude;
      input.geometry.attributes.normal = { array: values, count: 3, itemSize: 3, stride, offset: 0, normalized: true };
      const original = [...values];
      assert.equal(validateModelMaterialChannels(input).kind, 'mesh-standard');
      assert.deepEqual([...values], original);
    }), runs);
});
