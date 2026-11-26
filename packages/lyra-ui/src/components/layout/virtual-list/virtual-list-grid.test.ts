import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-virtual-list.js';
import type { LyraVirtualList } from '../../lr-virtual-list.js';

it('keeps responsive cells keyed and addressed by item index', async () => {
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list dir="rtl" columns="auto" min-cell-width="90"
    style="inline-size:320px;--lr-virtual-list-height:120px" row-height="40" overscan="0"
    .source=${{ count: 1001, itemAt: (i: number) => i, keyAt: (i: number) => `tile-${i}`, indexOfKey: () => 995 }}
    .renderItem=${(item: unknown) => html`<button>${item}</button>`}></lr-virtual-list>`);
  await waitUntil(() => list.offsetForIndex(3) === 40 && list.offsetForIndex(2) === 0);
  expect(list.offsetForIndex(1001)).equal(334 * 40);
  expect(list.indexAtOffset(40)).equal(3);
  const cell = (index: number) => list.shadowRoot!.querySelector<HTMLElement>(`[data-row-index="${index}"]`);
  expect(cell(0)!.getBoundingClientRect().left).greaterThan(cell(1)!.getBoundingClientRect().left);
  list.scrollToIndex(995, { align: 'start', behavior: 'instant' });
  await waitUntil(() => !!cell(995));
  list.activeItemId = 'tile-995';
  await list.updateComplete;
  expect(cell(995)!.getAttribute('aria-current')).equal('true');
  expect(cell(995)!.getAttribute('aria-posinset')).equal('996');
  list.style.inlineSize = '210px';
  await waitUntil(() => list.offsetForIndex(2) === 40);
  expect(list.offsetForIndex(1001)).equal(501 * 40);
  list.columns = 1;
  await list.updateComplete;
  expect(list.offsetForIndex(2)).equal(80);
});

it('sizes fixed-column square cells from the allocated width', async () => {
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list columns="2" style="inline-size:240px"
    .items=${[0, 1, 2]}></lr-virtual-list>`);
  await waitUntil(() => list.offsetForIndex(2) === 120);
  list.cellAspectRatio = 2;
  await list.updateComplete;
  expect(list.offsetForIndex(3)).equal(120);
  list.cellAspectRatio = -2;
  await list.updateComplete;
  expect(list.offsetForIndex(3)).equal(240);
});

it('resolves exact fractional row boundaries to the first cell in that row', async () => {
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list columns="7" overscan="0"
    style="inline-size:222px" .items=${Array.from({ length: 31 }, (_, index) => index)}></lr-virtual-list>`);
  await waitUntil(() => list.offsetForIndex(7) === 222 / 7);
  const boundary = list.offsetForIndex(21);
  expect(list.indexAtOffset(boundary - 0.001)).to.equal(14);
  expect(list.indexAtOffset(boundary)).to.equal(21);
  expect(list.indexAtOffset(boundary + 0.001)).to.equal(21);
  expect(list.indexAtOffset(list.offsetForIndex(31))).to.equal(28);
  expect(list.indexAtOffset(Infinity)).to.equal(28);
});

it('keeps the row at an exact fractional bottom boundary outside the visible range', async () => {
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list columns="2" overscan="0"
    .rowHeight=${100 / 29} style="--lr-virtual-list-height:100px"
    .items=${Array.from({ length: 70 }, (_, index) => index)}></lr-virtual-list>`);
  const rows = () => list.shadowRoot!.querySelectorAll('[data-row-index]');
  await waitUntil(() => rows().length >= 58);
  expect(list.offsetForIndex(58)).to.equal(100);
  expect(rows().length).to.equal(58);

  // This is the next representable number below row 17's top. Dividing it by rowHeight
  // rounds up to 17 even though the viewport is still in row 16.
  const justBeforeRow = 58.620689655172406;
  expect(justBeforeRow).to.be.lessThan(list.offsetForIndex(34));
  expect(list.indexAtOffset(justBeforeRow)).to.equal(32);
});

it('loads through partial final rows after resizing and replacing an indexed source', async () => {
  const source = (count: number) => ({ count, itemAt: (index: number) => index });
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list
    columns="auto" min-cell-width="100" row-height="40" overscan="0" has-more loading
    style="inline-size:320px;--lr-virtual-list-height:80px"
    .source=${source(10)}></lr-virtual-list>`);
  const cell = (index: number) => list.shadowRoot!.querySelector(`[data-row-index="${index}"]`);
  let requests = 0;
  list.addEventListener('lr-load-more', () => { requests++; });
  await waitUntil(() => list.offsetForIndex(10) === 160 && cell(5) !== null);
  list.scrollToIndex(9, { align: 'end', behavior: 'instant' });
  await waitUntil(() => cell(9) !== null);
  expect(requests).to.equal(0);
  list.loading = false;
  await waitUntil(() => requests === 1);

  list.style.inlineSize = '220px';
  await waitUntil(() => list.offsetForIndex(10) === 200 && cell(9) === null);
  list.source = source(11);
  await list.updateComplete;
  expect(list.offsetForIndex(11)).to.equal(240);
  expect(requests).to.equal(1);
  list.scrollToIndex(10, { align: 'end', behavior: 'instant' });
  await waitUntil(() => requests === 2);
  expect(cell(10)?.getAttribute('aria-posinset')).to.equal('11');
  expect(cell(10)?.getAttribute('aria-setsize')).to.equal('11');
});

it('switches to the documented single-column layout for groups and table rows', async () => {
  const list = await fixture<LyraVirtualList>(html`<lr-virtual-list columns="3" row-height="40"
    .items=${[0, 1, 2, 3]}></lr-virtual-list>`);
  expect(list.offsetForIndex(1)).to.equal(0);
  list.groups = [{ startIndex: 1, key: 'section', label: '' }];
  await list.updateComplete;
  expect(list.offsetForIndex(1)).to.equal(40);
  list.groups = undefined;
  await list.updateComplete;
  expect(list.offsetForIndex(1)).to.equal(0);
  list.itemRole = 'row';
  await list.updateComplete;
  expect(list.offsetForIndex(1)).to.equal(40);
});
