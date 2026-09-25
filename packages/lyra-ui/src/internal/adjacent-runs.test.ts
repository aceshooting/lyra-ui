import { expect } from '@open-wc/testing';
import { measureAdjacentRuns } from './adjacent-runs.js';

// Pure geometry: every rect is stubbed, so these cases never depend on layout, fonts or engine
// rounding. Each item is a detached element whose getBoundingClientRect() returns a fixed box.
function box(left: number, top: number, width = 40, height = 32): Element {
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  return element;
}

const always = (): boolean => true;

describe('measureAdjacentRuns()', () => {
  it('joins touching items on one row into start/middle/end', () => {
    const items = [box(0, 0), box(40, 0), box(80, 0)];
    expect(measureAdjacentRuns(items, { direction: 'ltr', joinable: always })).to.deep.equal([
      'start',
      'middle',
      'end',
    ]);
  });

  it('keeps a lone item standalone and returns an empty list for no items', () => {
    expect(measureAdjacentRuns([box(0, 0)], { direction: 'ltr', joinable: always })).to.deep.equal([
      'standalone',
    ]);
    expect(measureAdjacentRuns([], { direction: 'ltr', joinable: always })).to.deep.equal([]);
  });

  it('tolerates a collapsed shared border but splits a real gap', () => {
    // -1px (one collapsed border) and +1px (sub-pixel rounding) still join; 2px does not.
    expect(
      measureAdjacentRuns([box(0, 0), box(39, 0), box(80, 0)], { direction: 'ltr', joinable: always }),
    ).to.deep.equal(['start', 'middle', 'end']);
    expect(
      measureAdjacentRuns([box(0, 0), box(42, 0)], { direction: 'ltr', joinable: always }),
    ).to.deep.equal(['standalone', 'standalone']);
  });

  it('splits items on different rows even when their inline edges align', () => {
    expect(
      measureAdjacentRuns([box(0, 0), box(40, 0), box(80, 40)], { direction: 'ltr', joinable: always }),
    ).to.deep.equal(['start', 'end', 'standalone']);
  });

  it('never joins a zero-size (hidden) item', () => {
    expect(
      measureAdjacentRuns([box(0, 0), box(40, 0, 0, 0), box(40, 0)], {
        direction: 'ltr',
        joinable: always,
      }),
    ).to.deep.equal(['standalone', 'standalone', 'standalone']);
  });

  it('mirrors the gap under RTL, where later items sit further left', () => {
    const rtl = [box(80, 0), box(40, 0), box(0, 0)];
    expect(measureAdjacentRuns(rtl, { direction: 'rtl', joinable: always })).to.deep.equal([
      'start',
      'middle',
      'end',
    ]);
    // The same geometry read as LTR is three separated items.
    expect(measureAdjacentRuns(rtl, { direction: 'ltr', joinable: always })).to.deep.equal([
      'standalone',
      'standalone',
      'standalone',
    ]);
  });

  it('breaks the run wherever joinable() refuses an item', () => {
    const items = [box(0, 0), box(40, 0), box(80, 0), box(120, 0)];
    const refused = items[2]!;
    const calls: number[] = [];
    const positions = measureAdjacentRuns(items, {
      direction: 'ltr',
      joinable: (item, index) => {
        calls.push(index);
        return item !== refused;
      },
    });
    expect(positions).to.deep.equal(['start', 'end', 'standalone', 'standalone']);
    expect(calls.every((index) => index >= 0 && index < items.length)).to.equal(true);
  });
});
