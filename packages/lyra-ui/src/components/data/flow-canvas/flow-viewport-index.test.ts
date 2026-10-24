import { expect } from '@open-wc/testing';
import { FlowViewportIndex } from './flow-viewport-index.js';

interface Card { readonly id: string }

describe('FlowViewportIndex', () => {
  const card = (id: string): Card => ({ id });
  const ids = (found: readonly Card[]): string[] => found.map((entry) => entry.id);

  it('ignores a bounds update for a value that was never indexed', () => {
    const known = card('known');
    const index = new FlowViewportIndex([{ value: known, bounds: { left: 0, top: 0, right: 10, bottom: 10 } }]);
    index.update(card('stranger'), { left: 0, top: 0, right: 500, bottom: 500 });
    expect(ids(index.query({ left: 100, top: 100, right: 200, bottom: 200 }))).to.deep.equal([]);
    expect(ids(index.query({ left: 5, top: 5, right: 6, bottom: 6 }))).to.deep.equal(['known']);
  });

  it('moves an indexed value when its measured bounds change', () => {
    const cards = Array.from({ length: 20 }, (_, position) => card(`card-${position}`));
    const index = new FlowViewportIndex(cards.map((value, position) => ({
      value, bounds: { left: position * 100, top: 0, right: position * 100 + 50, bottom: 40 },
    })));
    expect(ids(index.query({ left: 1900, top: 0, right: 1950, bottom: 40 }))).to.deep.equal(['card-19']);
    index.update(cards[19]!, { left: 0, top: 500, right: 50, bottom: 540 });
    expect(ids(index.query({ left: 1900, top: 0, right: 1950, bottom: 40 }))).to.deep.equal([]);
    expect(ids(index.query({ left: 0, top: 500, right: 50, bottom: 540 }))).to.deep.equal(['card-19']);
    expect(ids(index.query({ left: 0, top: 0, right: 10, bottom: 10 }))).to.deep.equal(['card-0']);
  });

  it('returns matches in the order they were indexed', () => {
    const cards = ['c', 'a', 'b'].map(card);
    const index = new FlowViewportIndex(cards.map((value) => ({ value, bounds: { left: 0, top: 0, right: 10, bottom: 10 } })));
    expect(ids(index.query({ left: 0, top: 0, right: 10, bottom: 10 }))).to.deep.equal(['c', 'a', 'b']);
  });
});
