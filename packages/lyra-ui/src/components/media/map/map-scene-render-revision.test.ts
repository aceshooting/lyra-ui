import { expect } from '@open-wc/testing';
import { nextSceneRenderRevision } from './map-scene-render-input.js';

describe('map scene render revision boundary', () => {
  it('advances safe nonnegative counters and refuses exhaustion or malformed numeric input without wrapping', () => {
    expect(nextSceneRenderRevision(0)).to.equal(1);
    expect(nextSceneRenderRevision(41)).to.equal(42);
    expect(nextSceneRenderRevision(Number.MAX_SAFE_INTEGER - 1)).to.equal(Number.MAX_SAFE_INTEGER);
    for (const value of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, -1, 0.5, NaN, Infinity, -Infinity]) {
      expect(nextSceneRenderRevision(value)).to.equal(undefined);
    }
  });
});
