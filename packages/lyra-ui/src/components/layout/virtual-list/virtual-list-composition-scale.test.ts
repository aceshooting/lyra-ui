import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { setVirtualListCompositionProfile } from '../../../internal/virtual-list-composition.js';
import './virtual-list.js';
import type { LyraVirtualList } from './virtual-list.class.js';

async function settle(el: LyraVirtualList) {
  for (let i = 0; i < 4; i++) { await el.updateComplete; await nextFrame(); }
}
const rows = (el: LyraVirtualList) => el.renderedRows;
const source = { count: 1_000_000, itemAt: (index: number) => index, keyAt: (index: number) => `n${index}`,
  indexOfKey: (key: string | number) => Number(String(key).slice(1)) };
const render = (value: unknown) => html`<button role="treeitem" style="height:40px" data-node=${value}>Node ${value}</button>`;

for (const projection of ['shadow', 'light'] as const) it(`makes ${projection} structural wrappers transparent and restores public roles without keyless refresh`, async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list .rowProjection=${projection} row-height="40" style="--lr-virtual-list-height:120px" .items=${[0, 1, 2]} .renderItem=${render} aria-label="Owned list"></lr-virtual-list>`);
  await settle(el);
  const base = el.scrollContainer!;
  expect(base.getAttribute('role')).to.equal('list');
  expect(base.getAttribute('tabindex')).to.equal('0');
  expect(rows(el)[0]!.getAttribute('role')).to.equal('listitem');
  const content = () => (projection === 'light' ? el : el.shadowRoot!).querySelector<HTMLButtonElement>('[data-node="0"]')!;
  await focusByKeyboard(content());
  let keyless = 0;
  const original = el.requestUpdate;
  el.requestUpdate = function (...args) { if (args[0] === undefined) keyless++; original.apply(this, args); };
  try {
    setVirtualListCompositionProfile(el, { maxRows: 20 });
    await settle(el);
    expect(base.getAttribute('role')).to.equal('presentation');
    expect(base.hasAttribute('tabindex')).to.equal(false);
    expect(base.hasAttribute('aria-label')).to.equal(false);
    expect(base.hasAttribute('aria-busy')).to.equal(false);
    for (const row of rows(el)) {
      expect(row.getAttribute('role')).to.equal('presentation');
      expect(row.hasAttribute('aria-setsize') || row.hasAttribute('aria-posinset') || row.hasAttribute('aria-current')).to.equal(false);
    }
    expect(content().matches(':focus')).to.equal(true);
    expect(keyless).to.equal(0);
    el.itemRole = 'row';
    setVirtualListCompositionProfile(el, undefined);
    await settle(el);
    expect(base.getAttribute('role')).to.equal('rowgroup');
    expect(base.getAttribute('tabindex')).to.equal('0');
    expect(rows(el)[0]!.getAttribute('role')).to.equal('row');
    expect(rows(el)[0]!.getAttribute('aria-rowindex')).to.equal('1');
    expect(content().matches(':focus')).to.equal(true);
    expect(keyless).to.equal(0);
  } finally { el.requestUpdate = original; }
});

it('caps a large physical viewport including its retained focused row while reaching the final logical row', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="40" style="--lr-virtual-list-height:24000px" .source=${source} .renderItem=${render}></lr-virtual-list>`);
  setVirtualListCompositionProfile(el, { maxRows: 500 });
  await settle(el);
  expect(rows(el).length).to.be.at.most(500);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[data-node="0"]')!);
  el.scrollToIndex(999_999, { align: 'end', behavior: 'auto' });
  await settle(el); await settle(el);
  expect(rows(el).length).to.be.at.most(500);
  expect(rows(el).some(row => row.dataset['rowIndex'] === '999999')).to.equal(true);
  expect(el.shadowRoot!.querySelector('[data-node="0"]')?.matches(':focus')).to.equal(true);
  const last = rows(el).find(row => row.dataset['rowIndex'] === '999999')!.getBoundingClientRect();
  const viewport = el.scrollContainer!.getBoundingClientRect();
  expect(last.bottom).to.be.greaterThan(viewport.top);
  expect(last.top).to.be.lessThan(viewport.bottom);
  expect(el.offsetForIndex(1_000_000)).to.equal(40_000_000);
  expect(el.scrollContainer!.scrollHeight).to.be.at.most(8_000_000);
  recordScaleMeasurement('lr-virtual-list', 'n=1000000 composition focus budget', { mountedRows: rows(el).length });
});

it('preserves focused content when a profile shrinks through the current visible window', async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="40" style="--lr-virtual-list-height:400px" .items=${Array.from({ length: 30 }, (_, i) => i)} .renderItem=${render}></lr-virtual-list>`);
  await settle(el);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[data-node="5"]')!);
  setVirtualListCompositionProfile(el, { maxRows: 1 });
  await settle(el);
  expect(rows(el).length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[data-node="5"]')?.matches(':focus')).to.equal(true);
  setVirtualListCompositionProfile(el, undefined);
  await settle(el);
  expect(rows(el).length).to.be.greaterThan(1);
  expect(el.shadowRoot!.querySelector('[data-node="5"]')?.matches(':focus')).to.equal(true);
});

it('rejects invalid composition budgets and snapshots the accepted profile', async () => {
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="40" style="--lr-virtual-list-height:400px" .items=${Array.from({ length: 30 }, (_, i) => i)}></lr-virtual-list>`);
  const profile = { maxRows: 2 };
  setVirtualListCompositionProfile(el, profile);
  profile.maxRows = 500;
  for (const maxRows of [0, -1, 501, Infinity, NaN, 1.5])
    expect(() => setVirtualListCompositionProfile(el, { maxRows })).to.throw(RangeError);
  await settle(el);
  expect(rows(el).length).to.equal(2);
});

it('keeps indexed measurements and key lookup authority across named profile updates', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  let lookups = 0;
  let reads = 0;
  const measured = { ...source, itemAt: (index: number) => { reads++; return index; },
    indexOfKey: (key: string | number) => { lookups++; return source.indexOfKey(key); } };
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list data-lr-motion="reduce" style="--lr-virtual-list-height:160px" .source=${measured} .renderItem=${(value: unknown) => html`<div style="height:45px">${value}</div>`}></lr-virtual-list>`);
  setVirtualListCompositionProfile(el, { maxRows: 20 });
  await settle(el);
  el.activeItemId = 'n999999';
  await settle(el); await settle(el);
  expect(rows(el).some(row => row.dataset['rowIndex'] === '999999')).to.equal(true);
  const before = el.offsetForIndex(1_000_000) - el.offsetForIndex(999_999);
  expect(before).to.equal(45);
  lookups = 0; reads = 0;
  setVirtualListCompositionProfile(el, { maxRows: 15 });
  await settle(el);
  expect(lookups).to.equal(0);
  expect(reads).to.be.lessThan(100);
  expect(el.offsetForIndex(1_000_000) - el.offsetForIndex(999_999)).to.equal(before);
  expect(el.source === measured).to.equal(true);
  recordScaleMeasurement('lr-virtual-list', 'n=1000000 measured composition update', { lookups, reads, mountedRows: rows(el).length });
});

it('renders an explicit target already inside a physically visible but capped window', async () => {
  expectDevWarning('virtual-list-scroll-scaling');
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="40" style="--lr-virtual-list-height:24000px" .source=${source} .renderItem=${render}></lr-virtual-list>`);
  setVirtualListCompositionProfile(el, { maxRows: 5 });
  await settle(el);
  el.scrollToIndex(400, { align: 'auto', behavior: 'auto' });
  await settle(el);
  expect(rows(el).length).to.equal(5);
  expect(rows(el).some(row => row.dataset['rowIndex'] === '400')).to.equal(true);
  el.activeItemId = 'n500';
  await settle(el);
  expect(rows(el).some(row => row.dataset['rowIndex'] === '500')).to.equal(true);
});
