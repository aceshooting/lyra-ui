import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './virtual-list.js';
import type { LyraVirtualList } from './virtual-list.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
expectDevWarning('virtual-list-scroll-scaling');
async function settle(el: LyraVirtualList) {
  for (let i = 0; i < 4; i++) { await el.updateComplete; await nextFrame(); }
}
it('extends identities for a five thousand row prefix append', async () => {
  let keys = 0;
  const items = Array.from({ length: 5000 }, (_, i) => i);
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="40" style="--lr-virtual-list-height:200px" .items=${items} .keyFunction=${(item: unknown) => { keys++; return item as number; }}></lr-virtual-list>`);
  await settle(el); keys = 0;
  el.items = [...items, 5000]; await settle(el);
  expect(keys).lessThan(100);
  recordScaleMeasurement('lr-virtual-list', 'n=5000 append', { keys });
  keys = 0; el.activeItemId = 4999; await settle(el);
  expect(keys).lessThan(100);
  recordScaleMeasurement('lr-virtual-list', 'n=5001 active key lookup', { keys });
});
for (const variable of [false, true]) it(`keeps adjacent rows contiguous across a million-row ${variable ? 'variable' : 'fixed'} source`, async () => {
  const source = { count: 1000000, itemAt: (index: number) => index };
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:240px" row-height=${variable ? 'auto' : '48'} .source=${source} .renderItem=${(item: unknown) => html`<div style=${`height:${variable ? 40 + ((item as number) % 3) * 10 : 48}px`}>${item}</div>`}></lr-virtual-list>`);
  await settle(el);
  for (const index of [0, 500000, 999999]) {
    el.scrollToIndex(index, { align: index === 999999 ? 'end' : 'start', behavior: 'auto' });
    await settle(el); await settle(el);
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
    expect(rows.some(row => Number(row.dataset['rowIndex']) === index)).equal(true);
    for (let i = 1; i < rows.length; i++) {
      expect(Math.abs(rows[i]!.getBoundingClientRect().top - rows[i - 1]!.getBoundingClientRect().bottom)).lessThan(1.1);
    }
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const target = rows.find(row => Number(row.dataset['rowIndex']) === index)!;
    expect(target.getBoundingClientRect().bottom).greaterThan(base.getBoundingClientRect().top);
    expect(target.getBoundingClientRect().top).lessThan(base.getBoundingClientRect().bottom);
    recordScaleMeasurement('lr-virtual-list', `n=1000000 ${variable ? 'variable' : 'fixed'} index=${index}`, { mountedRows: rows.length, scrollHeight: base.scrollHeight });
  }
});
it('does not sweep row and group DOM on a stable scroll frame', async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:200px" .items=${Array.from({ length: 5000 }, (_, i) => i)} .renderItem=${() => html`<div style="height:48px"></div>`}></lr-virtual-list>`);
  await settle(el);
  const root = el.shadowRoot!;
  const original = root.querySelectorAll.bind(root);
  let sweeps = 0;
  root.querySelectorAll = ((selector: string) => { sweeps++; return original(selector); }) as typeof root.querySelectorAll;
  try {
    el.requestUpdate(); await settle(el);
    expect(sweeps).equal(0);
    recordScaleMeasurement('lr-virtual-list', 'n=5000 stable DOM observers', { sweeps });
  } finally { root.querySelectorAll = original; }
});
it('reuses external transform metrics across five scroll frames', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="height:200px;overflow:auto"><lr-virtual-list row-height="40" .source=${{ count: 5000, itemAt: (i: number) => i }}></lr-virtual-list></div>`);
  const el = wrapper.querySelector<LyraVirtualList>('lr-virtual-list')!;
  el.scrollElement = wrapper; await settle(el);
  const seam = el as unknown as { relativeBlockScale: (...args: unknown[]) => number };
  const original = seam.relativeBlockScale;
  let walks = 0;
  seam.relativeBlockScale = function(...args) { walks++; return original.apply(this, args); };
  try {
    for (let i = 1; i <= 5; i++) { wrapper.scrollTop = i * 100; wrapper.dispatchEvent(new Event('scroll')); await settle(el); }
    expect(walks).equal(0);
    recordScaleMeasurement('lr-virtual-list', 'n=5000 external scroll', { walks });
  } finally { seam.relativeBlockScale = original; }
});
it('updates only the tail offsets and retains the group prefix on row measurement', async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list style="--lr-virtual-list-height:200px" .items=${Array.from({ length: 5000 }, (_, i) => i)} .renderItem=${() => html`<div style="height:48px"></div>`}></lr-virtual-list>`);
  await settle(el);
  const seam = el as unknown as { rowIdentities: string[]; pendingRowMeasurements: Map<string, { index: number; height: number }>; applyPendingRowMeasurements: () => void; groupHeightAt: (index: number) => number; recomputeGroupHeightPrefix: () => void };
  const height = seam.groupHeightAt; const prefix = seam.recomputeGroupHeightPrefix;
  let offsets = 0; let prefixes = 0;
  seam.groupHeightAt = function(index) { offsets++; return height.call(this, index); };
  seam.recomputeGroupHeightPrefix = function() { prefixes++; prefix.call(this); };
  try {
    seam.pendingRowMeasurements.set(seam.rowIdentities[4999]!, { index: 4999, height: 60 });
    seam.applyPendingRowMeasurements(); await settle(el);
    expect(offsets).lessThan(100); expect(prefixes).equal(0);
    expect(el.offsetForIndex(5000) - el.offsetForIndex(4999)).equal(60);
    recordScaleMeasurement('lr-virtual-list', 'n=5000 tail measurement', { offsets, prefixes });
  } finally { seam.groupHeightAt = height; seam.recomputeGroupHeightPrefix = prefix; }
});
it('keeps external million-row windows contiguous and invalidates changed ancestor transforms', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="height:240px;overflow:auto"><lr-virtual-list row-height="auto" .source=${{ count: 1000000, itemAt: (i: number) => i }} .renderItem=${(item: unknown) => html`<div style=${`height:${40 + ((item as number) % 3) * 10}px`}>${item}</div>`}></lr-virtual-list></div>`);
  const el = wrapper.querySelector<LyraVirtualList>('lr-virtual-list')!;
  el.scrollElement = wrapper; await settle(el);
  for (const index of [0, 500000, 999999]) {
    el.scrollToIndex(index, { align: index === 999999 ? 'end' : 'start', behavior: 'auto' });
    await settle(el); await settle(el);
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
    expect(rows.some(row => Number(row.dataset['rowIndex']) === index)).equal(true);
    for (let i = 1; i < rows.length; i++) expect(Math.abs(rows[i]!.getBoundingClientRect().top - rows[i - 1]!.getBoundingClientRect().bottom)).lessThan(1.1);
    const target = rows.find(row => Number(row.dataset['rowIndex']) === index)!;
    expect(target.getBoundingClientRect().bottom).greaterThan(wrapper.getBoundingClientRect().top);
    expect(target.getBoundingClientRect().top).lessThan(wrapper.getBoundingClientRect().bottom);
  }
  wrapper.style.transform = 'scale(1.5)'; wrapper.style.transformOrigin = 'top left';
  await settle(el);
  el.scrollToIndex(500000, { align: 'start', behavior: 'auto' }); await settle(el); await settle(el);
  const target = el.shadowRoot!.querySelector<HTMLElement>('[part="row"][data-row-index="500000"]')!;
  expect(target !== null).equal(true);
  expect(Math.abs(target.getBoundingClientRect().top - wrapper.getBoundingClientRect().top)).lessThan(3);
});
it('keeps a focused offscreen row from enlarging a scaled spacer', async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="48" style="--lr-virtual-list-height:240px" .source=${{ count: 1000000, itemAt: (i: number) => i }} .renderItem=${(item: unknown) => html`<button>${item}</button>`}></lr-virtual-list>`);
  await settle(el);
  el.scrollToIndex(999999, { align: 'end', behavior: 'auto' }); await settle(el);
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-row-index="999999"] button')!;
  await focusByKeyboard(button);
  el.scrollToIndex(0, { align: 'start', behavior: 'auto' }); await settle(el);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(base.scrollHeight).at.most(8000001);
  expect(el.shadowRoot!.activeElement === button).equal(true);
});
it('refreshes mutable identity assignments without changing an earlier snapshot', async () => {
  const items = Array.from({ length: 5000 }, (_, index) => ({ index, label: String(index) }));
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="40" .items=${items} .keyFunction=${(item: unknown) => (item as { index: number }).index} .renderItem=${(item: unknown) => html`${(item as { label: string }).label}`}></lr-virtual-list>`);
  await settle(el);
  const retained = el.items;
  items[0]!.label = 'Updated'; items.push({ index: 5000, label: 'Tail' });
  el.items = items; await settle(el);
  expect(retained.length).equal(5000); expect(el.items.length).equal(5001);
  expect(el.shadowRoot!.querySelector('[data-row-index="0"]')!.textContent).contain('Updated');
  items.splice(0, 1); el.items = items; await settle(el);
  expect(el.items.length).equal(5000);
  expect(el.shadowRoot!.querySelector('[data-row-index="0"]')!.textContent).contain('1');
});
