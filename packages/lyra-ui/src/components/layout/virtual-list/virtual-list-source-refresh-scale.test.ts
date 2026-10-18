import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './virtual-list.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import type { LyraVirtualList } from './virtual-list.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
expectDevWarning('virtual-list-scroll-scaling');

it('refreshes an indexed active key when an explicit request coalesces with loading', async () => {
  let reversed = false;
  const source = { count: 1000000, itemAt: (index: number) => index,
    keyAt: (index: number) => `row-${reversed ? 999999 - index : index}`,
    indexOfKey: (key: string | number) => reversed ? 999999 - Number(String(key).slice(4)) : Number(String(key).slice(4)) };
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="40" style="--lr-virtual-list-height:200px"
    .source=${source} .activeItemId=${'row-0'} .renderItem=${(item: unknown) => html`${item}`}>
  </lr-virtual-list>`);
  await waitUntil(() => Boolean(list.shadowRoot!.querySelector('[part="row"][aria-current="true"]')));
  reversed = true;
  list.loading = true;
  list.requestUpdate();
  await list.updateComplete;
  const current = list.shadowRoot!.querySelector('[part="row"][aria-current="true"]');
  expect(current?.getAttribute('data-row-key') ?? 'string:row-0').to.equal('string:row-0');
  list.scrollToIndex(999999, { align: 'end', behavior: 'auto' });
  await waitUntil(() => list.shadowRoot!.querySelector('[data-row-index="999999"][aria-current="true"]') !== null);
  expect(list.shadowRoot!.querySelector('[data-row-index="999999"][aria-current="true"]')!.getAttribute('data-row-key')).to.equal('string:row-0');
});

it('addresses first, middle and final records with bounded indexed reads and source replacement', async () => {
  let reads = 0;
  const source = { count: 1000000, itemAt: (index: number) => { reads++; return index; },
    keyAt: (index: number) => `row-${index}`, indexOfKey: (key: string | number) => Number(String(key).slice(4)) };
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="40" style="--lr-virtual-list-height:200px"
    .source=${source} .renderItem=${(item: unknown) => html`${item}`}>
  </lr-virtual-list>`);
  for (const index of [0, 500000, 999999]) {
    reads = 0;
    list.scrollToIndex(index, { align: index === 999999 ? 'end' : 'start', behavior: 'auto' });
    await waitUntil(() => list.shadowRoot!.querySelector(`[data-row-index="${index}"]`) !== null);
    expect(list.shadowRoot!.querySelector(`[data-row-index="${index}"]`)!.textContent).to.include(String(index));
    const mounted = list.shadowRoot!.querySelectorAll('[part="row"]').length;
    expect(reads).to.be.lessThan(100);
    expect(mounted).to.be.lessThan(30);
    recordScaleMeasurement('lr-virtual-list', `n=1000000 index=${index}`, { reads, mountedRows: mounted });
  }
  list.activeItemId = 'row-999999';
  await list.updateComplete;
  list.source = { ...source, keyAt: index => `row-${999999 - index}`, indexOfKey: key => 999999 - Number(String(key).slice(4)) };
  await list.updateComplete;
  list.scrollToIndex(0, { behavior: 'auto', align: 'start' });
  await waitUntil(() => list.shadowRoot!.querySelector('[data-row-index="0"][aria-current="true"]') !== null);
  expect(list.shadowRoot!.querySelector('[aria-current="true"]')!.getAttribute('data-row-key')).to.equal('string:row-999999');
});
