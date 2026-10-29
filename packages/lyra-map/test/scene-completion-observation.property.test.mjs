import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { mapSceneAnchorPixel } from '../src/scene/completion-observation.mjs';

const runs = { seed: 0x5eed_0b53, numRuns: 200, includeErrorInReport: true };
const dimensions = fc.record({ width: fc.integer({ min: 1, max: 4096 }), height: fc.integer({ min: 1, max: 4096 }),
  backingWidth: fc.integer({ min: 1, max: 8192 }), backingHeight: fc.integer({ min: 1, max: 8192 }),
  exponent: fc.integer({ min: 0, max: 8 }), x: fc.nat(1_000_000), y: fc.nat(1_000_000) });

test('physical anchor mapping agrees with an independent exact dyadic rational cell oracle', () => {
  fc.assert(fc.property(dimensions, value => {
    const denominator = 2 ** value.exponent;
    const nx = value.x % (value.width * denominator), ny = value.y % (value.height * denominator);
    const expectedX = Number(BigInt(nx) * BigInt(value.backingWidth) / BigInt(value.width * denominator));
    const expectedTopY = Number(BigInt(ny) * BigInt(value.backingHeight) / BigInt(value.height * denominator));
    const point = [nx / denominator, ny / denominator];
    const allocation = { width: value.width, height: value.height, backingWidth: value.backingWidth, backingHeight: value.backingHeight };
    const result = mapSceneAnchorPixel(point, allocation);
    assert.deepEqual(result, [expectedX, value.backingHeight - 1 - expectedTopY]);
    assert.ok(result[0] >= 0 && result[0] < value.backingWidth && result[1] >= 0 && result[1] < value.backingHeight);
    assert.equal(mapSceneAnchorPixel([value.width, point[1]], allocation), undefined);
    assert.equal(mapSceneAnchorPixel([point[0], value.height], allocation), undefined);
  }), runs);
});
