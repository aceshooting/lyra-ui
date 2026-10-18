import { expect, fixture, html } from '@open-wc/testing';
import './virtual-list.js';
import type { LyraVirtualList } from './virtual-list.class.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

(globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> }).litIssuedWarnings?.add('virtual-list-scroll-scaling');

it('resolves auto-row geometry through indexed keys without demanding distant records', async () => {
  let reads = 0;
  const source = { count: 1_000_000, itemAt: (index: number) => { reads++; return `Row ${index}`; }, keyAt: (index: number) => `key-${index}` };
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list style="height:240px" .source=${source}
    .renderItem=${(item: unknown) => html`<div>${item}</div>`}></lr-virtual-list>`);
  const internal = list as unknown as { rowHeightAt(index: number): number; identityAt(index: number, item?: unknown): string };
  reads = 0;
  for (const index of [500_000, 750_000, 999_999]) {
    expect(internal.rowHeightAt(index)).to.equal(48);
    expect(internal.identityAt(index)).to.contain(`key-${index}`);
  }
  expect(reads, 'geometry-only source row reads').to.equal(0);
  recordScaleMeasurement('lr-virtual-list', 'source-auto-demand@1000000', { logicalRows: 1_000_000, geometryQueries: 6, itemReads: reads });
});

it('preserves explicit item and caller keyFunction semantics', async () => {
  let reads = 0;
  const source = { count: 10, itemAt: (index: number) => { reads++; return `Row ${index}`; } };
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list .source=${source}
    .keyFunction=${(item: unknown) => String(item)}></lr-virtual-list>`);
  const internal = list as unknown as { identityAt(index: number, item?: unknown): string };
  reads = 0;
  expect(internal.identityAt(5, 'explicit')).to.contain('explicit');
  expect(reads).to.equal(0);
  expect(internal.identityAt(5)).to.contain('Row 5');
  expect(reads).to.equal(1);
  list.keyFunction = undefined;
  await list.updateComplete;
  reads = 0;
  internal.identityAt(5);
  expect(reads).to.equal(0);
});
