import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { projectMapVectorStyle, resolveMapVectorStyle } from './map-vector-style.js';

describe('map vector style properties', () => {
  it('snapshots finite bounded constants without retaining caller state', () => {
    fc.assert(fc.property(fc.double({ min: 0, max: 100, noNaN: true }), width => {
      const paint = { 'line-width': width };
      const style = projectMapVectorStyle({ render: 'line', hasLabel: false, paint })!;
      paint['line-width'] = -1;
      expect(style.paint['line-width']).to.equal(width);
      expect(Object.isFrozen(style.paint)).to.equal(true);
      expect(resolveMapVectorStyle(style, value => value).paint['line-width']).to.equal(width);
    }), propertyRuns());
  });
  it('rejects every finite line width outside the admitted interval', () => {
    fc.assert(fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }).filter(n => n < 0 || n > 100), width => {
      expect(projectMapVectorStyle({ render: 'line', hasLabel: false, paint: { 'line-width': width } })).to.equal(undefined);
    }), propertyRuns());
  });
  it('enforces the exact match branch limit without mutating authored arrays', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 40 }), count => {
      const expression = ['match', ['get', 'kind'], ...Array.from({ length: count }, (_, index) => [index, 1]).flat(), 2];
      const before = JSON.stringify(expression);
      const style = projectMapVectorStyle({ render: 'line', hasLabel: false, paint: { 'line-width': expression } });
      expect(style !== undefined).to.equal(count <= 32);
      expect(JSON.stringify(expression)).to.equal(before);
      if (style) {
        const resolved = resolveMapVectorStyle(style, value => value);
        expect(JSON.stringify(resolved).length).to.be.lessThan(8 * 1024 * 1024);
        expect(Object.isFrozen(style.paint['line-width'])).to.equal(true);
      }
    }), propertyRuns());
  });
  it('never rewrites feature keys or match labels resembling colors', () => {
    fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 100 }), key => {
      const style = projectMapVectorStyle({ render: 'line', hasLabel: false, paint: { 'line-color': ['match', ['get', key], key, 'red', 'blue'] } })!;
      expect(resolveMapVectorStyle(style, () => '#000000').paint['line-color']).to.deep.equal(['match', ['get', key], key, '#000000', '#000000']);
    }), propertyRuns());
  });
});
