import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { projectMapStyleOverrides } from './map-style-override-admission.js';

describe('expanded style override admission properties', () => {
  it('preserves every bounded root entry without widening authored input or expression limits', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 1025 }), fc.boolean(), (count, append) => {
      const input = Array.from({ length: count }, (_, index) => ({ layerId: `layer-${index}`, before: append ? null : 'labels' }));
      const expanded = projectMapStyleOverrides(input, true);
      expect(expanded !== undefined).to.equal(count <= 1024);
      expect(projectMapStyleOverrides(input) !== undefined).to.equal(count <= 64);
      if (expanded) {
        expect(expanded.map(entry => entry.layerId)).to.deep.equal(input.map(entry => entry.layerId));
        expect(expanded.every(entry => entry.before === (append ? null : 'labels') && Object.isFrozen(entry))).to.equal(true);
        expect(Object.isFrozen(expanded)).to.equal(true);
      }
    }), propertyRuns());
  });

  it('rejects an inaccessible root entry without invoking it or truncating to valid siblings', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1024 }), fc.nat(), (count, chosen) => {
      const input = Array.from({ length: count }, (_, index) => ({ layerId: `layer-${index}` }));
      let reads = 0;
      Object.defineProperty(input, String(chosen % count), { enumerable: true, get() { reads += 1; return { layerId: 'inaccessible' }; } });
      expect(projectMapStyleOverrides(input, true) === undefined).to.equal(true);
      expect(reads).to.equal(0);
    }), propertyRuns());
  });
});
