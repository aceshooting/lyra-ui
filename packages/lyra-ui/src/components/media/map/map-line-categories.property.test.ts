import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { projectMapDataLayers } from './map-data-layer-runtime.js';

function lineOptions(line: unknown) {
  const row = { sourceId: 'route', geojson: { type: 'FeatureCollection', features: [] }, line };
  const model = projectMapDataLayers([row], location.href, location.origin);
  if (!model.ok || !model.geojson[0]?.line) throw new Error('Missing line options');
  return model.geojson[0].line;
}

it('snapshots bounded constant patterns and rejects unusable lengths', () => {
  const part = fc.oneof(fc.integer({ min: -1, max: 260 }), fc.constantFrom(Infinity, NaN, 0));
  fc.assert(fc.property(fc.array(part, { maxLength: 40 }), pattern => {
    const projected = lineOptions({ dash: pattern });
    const usable = pattern.length <= 32 && pattern.some(value => value > 0) &&
      pattern.every(value => Number.isFinite(value) && value >= 0 && value <= 256);
    const expected = usable ? [...pattern] : undefined;
    pattern.fill(-1);
    expect(projected.dash).to.deep.equal(expected);
  }), propertyRuns());
});

it('admits the first usable category, skips accessors and ignores pairs beyond the limit', () => {
  let calls = 0;
  const getter = Object.defineProperty([], '0', { get() { calls++; return 'unexpected'; } });
  const colors = [null, 'bad pair', getter, ['rail', 'url(unsafe)'], ['rail', 'blue'], ['rail', 'red']];
  const dash = Array.from({ length: 33 }, () => ['rail', [0, 0]]);
  dash[1] = ['rail', [2, 1]];
  dash[2] = ['rail', [4, 2]];
  dash[32] = ['air', [1, 2]];
  const projected = lineOptions({ field: 'mode', colors, dash });
  expect(projected.colors).to.deep.equal([['rail', 'blue']]);
  expect(projected.dash).to.deep.equal(['match', ['get', 'mode'], 'rail', ['literal', [2, 1]], ['literal', [1]]]);
  expect(lineOptions({ dash }).dash).to.equal(undefined);
  expect(calls).to.equal(0);
});
