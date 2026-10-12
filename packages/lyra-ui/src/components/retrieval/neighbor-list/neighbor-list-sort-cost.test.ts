import { expect, fixture, html } from '@open-wc/testing';
import './neighbor-list.js';
import type { LyraNeighborList, LyraNeighborRow } from './neighbor-list.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getCollator } from '../../../internal/intl-cache.js';

it('resolves the locale once for a grouped sort while retaining stable relation order', async () => {
  const rows: LyraNeighborRow[] = Array.from({ length: 96 }, (_, index) => ({
    relation: `relation-${(index * 37) % 16}`,
    direction: 'out',
    node: { id: `node-${index}`, label: `Node ${index}` },
  }));
  const list = await fixture<LyraNeighborList>(html`<lr-neighbor-list></lr-neighbor-list>`);
  list.rows = rows;
  list.groupByRelation = true;
  const localeGetter = Object.getOwnPropertyDescriptor(LyraElement.prototype, 'effectiveLocale')!.get!;
  let localeReads = 0;
  Object.defineProperty(list, 'effectiveLocale', {
    configurable: true,
    get() {
      localeReads++;
      return localeGetter.call(this);
    },
  });
  let sorted: readonly LyraNeighborRow[];
  try {
    sorted = (list as unknown as { computeSortedRows(): readonly LyraNeighborRow[] }).computeSortedRows();
  } finally {
    Reflect.deleteProperty(list, 'effectiveLocale');
  }
  const compare = getCollator(localeGetter.call(list)).compare;
  const expected = [...rows].sort((a, b) => compare(a.relation, b.relation));
  expect(sorted.map((row) => row.node.id)).to.deep.equal(expected.map((row) => row.node.id));
  expect(rows.map((row) => row.node.id)).to.deep.equal(Array.from({ length: 96 }, (_, index) => `node-${index}`));
  expect(localeReads).to.equal(1);
});
