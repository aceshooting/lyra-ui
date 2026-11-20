import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { chartKeyboardStep, spatialBinAt, spatialKeyboardItems } from './chart-spatial-model.js';
import type { LyraSpatialBin, LyraSpatialChartPoint } from '../../../utilities/data-spatial.js';

const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'a', 'PageDown'];

describe('chart spatial model properties', () => {
  it('moves within [0, length) by at most one step, mirroring inline arrows under RTL', () => {
    fc.assert(fc.property(fc.constantFrom(...KEYS), fc.boolean(), fc.integer({ min: 1, max: 500 }), fc.nat(), (key, rtl, length, seed) => {
      const index = seed % length;
      const next = chartKeyboardStep(key, rtl, index, length);
      const forward = key === 'ArrowDown' || key === (rtl ? 'ArrowLeft' : 'ArrowRight');
      const backward = key === 'ArrowUp' || key === (rtl ? 'ArrowRight' : 'ArrowLeft');
      const expected = forward ? Math.min(length - 1, index + 1) : backward ? Math.max(0, index - 1)
        : key === 'Home' ? 0 : key === 'End' ? length - 1 : undefined;
      expect(next, `${key} rtl=${rtl} ${index}/${length}`).to.equal(expected);
    }), propertyRuns());
  });

  it('orders shown series points before every bin and drops hidden series', () => {
    const point = (id: string): LyraSpatialChartPoint => ({ id, seriesId: 's', x: 0, y: 0, sourceIndex: 0 }) as LyraSpatialChartPoint;
    fc.assert(fc.property(fc.array(fc.nat({ max: 5 }), { maxLength: 6 }), fc.array(fc.nat({ max: 5 }), { maxLength: 6 }), fc.nat({ max: 4 }),
      (sizes, hidden, binCount) => {
        const groups = sizes.map((size, group) => Array.from({ length: size }, (_, index) => point(`${group}:${index}`)));
        const bins = Array.from({ length: binCount }, (_, count) => ({ count, bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 } }) as LyraSpatialBin);
        const items = spatialKeyboardItems(groups, hidden, bins);
        const shown = groups.filter((_, index) => !hidden.includes(index)).flat();
        expect(items.map(item => 'id' in item ? item.id : `bin${item.count}`))
          .to.deep.equal([...shown.map(item => item.id), ...bins.map(bin => `bin${bin.count}`)]);
      }), propertyRuns());
  });

  it('hits a bin exactly inside its painted rectangle, with 2px slop only on a zero-size edge', () => {
    const coordinate = fc.integer({ min: -50, max: 50 });
    fc.assert(fc.property(coordinate, coordinate, coordinate, coordinate, coordinate, coordinate, (x1, x2, y1, y2, x, y) => {
      const bin = { count: 1, bounds: { minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minY: Math.min(y1, y2), maxY: Math.max(y1, y2) } } as LyraSpatialBin;
      // Screen y grows downward: the bin's top edge is its maximum data y.
      const hit = spatialBinAt([bin], x, y, (px, py) => ({ x: px, y: -py })) === bin;
      const { minX, maxX, minY, maxY } = bin.bounds;
      const slopX = minX === maxX ? 2 : 0, slopY = minY === maxY ? 2 : 0;
      expect(hit).to.equal(x >= minX - slopX && x <= maxX + slopX && y >= -maxY - slopY && y <= -minY + slopY);
    }), propertyRuns());
  });
});
