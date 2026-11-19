import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { hitTestHighlightRanges } from './text-highlights.js';

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const coordinate = fc.integer({ min: -20, max: 120 });
const box = fc.tuple(coordinate, coordinate, fc.integer({ min: 0, max: 60 }), fc.integer({ min: 0, max: 60 }))
  .map(([left, top, width, height]): Box => ({ left, top, right: left + width, bottom: top + height }));

/** Reference: flatten every rectangle topmost range first, then scan at most `budget` of them. */
function naiveHit(entries: readonly { id: string; boxes: readonly Box[] }[], x: number, y: number, budget: number): string | null {
  const ordered = [...entries].reverse().flatMap(({ id, boxes }) => boxes.map((rect) => ({ id, rect })));
  const scanned = ordered.slice(0, budget);
  const hit = scanned.find(({ rect }) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  return hit?.id ?? null;
}

it('hitTestHighlightRanges returns the first containing rectangle, topmost range first, within its budget', () => {
  const entries = fc.array(fc.record({ id: fc.string({ maxLength: 4 }), boxes: fc.array(box, { maxLength: 6 }) }), { maxLength: 8 });
  fc.assert(fc.property(entries, coordinate, coordinate, (list, x, y) => {
    const ranges = list.map(({ id, boxes }) => ({ id, range: { getClientRects: () => boxes } }));
    expect(hitTestHighlightRanges(ranges, x, y)).to.equal(naiveHit(list, x, y, 1_000));
  }), propertyRuns());
});

it('hitTestHighlightRanges never inspects more than its rectangle budget', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 2_400 }), (count) => {
    let inspected = 0;
    const boxes = {
      *[Symbol.iterator](): IterableIterator<Box> {
        for (let index = 0; index < count; index++) {
          inspected += 1;
          yield { left: 0, top: 0, right: 1, bottom: 1 };
        }
      },
    };
    expect(hitTestHighlightRanges([{ id: 'miss', range: { getClientRects: () => boxes } }], 50, 50)).to.equal(null);
    expect(inspected).to.equal(Math.min(count, 1_001));
  }), propertyRuns(50));
});
