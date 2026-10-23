import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { buildMapLabelLayer, projectMapLabelOptions, projectMapRowPlacement } from './map-data-layer-model.js';

describe('map row placement properties', () => {
  it('clamps finite ordered ranges and preserves equality', () => {
    fc.assert(fc.property(fc.integer({ min: -100, max: 100 }), fc.integer({ min: 0, max: 100 }), (start, distance) => {
      const row = { minZoom: start, maxZoom: start + distance };
      const result = projectMapRowPlacement(row);
      expect(result !== undefined).to.equal(true);
      expect(result?.minZoom).to.equal(Math.max(0, Math.min(24, start)));
      expect(result?.maxZoom).to.equal(Math.max(0, Math.min(24, start + distance)));
      expect(row).to.deep.equal({ minZoom: start, maxZoom: start + distance });
    }), propertyRuns());
  });
  it('copies physical offsets without changing their sign or retaining caller arrays', () => {
    fc.assert(fc.property(fc.integer({ min: -1600, max: 1600 }), fc.integer({ min: -1600, max: 1600 }), (x, y) => {
      const offset = [x / 100, y / 100];
      const input = { field: 'name', anchor: 'top', offset };
      const label = projectMapLabelOptions(input);
      expect(label !== undefined).to.equal(true);
      if (!label) return;
      offset[0] = 100;
      const layout = buildMapLabelLayer('label', 'source', label, value => value ?? '#000')['layout'] as Record<string, unknown>;
      expect(layout['text-offset']).to.deep.equal([x / 100, y / 100]);
      expect(Object.isFrozen(layout['text-offset'])).to.equal(true);
    }), propertyRuns());
  });
});
