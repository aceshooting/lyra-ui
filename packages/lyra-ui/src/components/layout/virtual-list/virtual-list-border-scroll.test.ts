import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraVirtualList } from './virtual-list.class.js';
import './virtual-list.js';

const ROW_HEIGHT = 40;
const TARGET_INDEX = 100;

async function borderedList(border: number, rowHeight: number | 'auto'): Promise<{
  scroller: HTMLElement;
  list: LyraVirtualList;
}> {
  const items = Array.from({ length: 200 }, (_, index) => index);
  const scroller = await fixture<HTMLElement>(html`
    <div style="block-size:200px;overflow:auto;border:${border}px solid black">
      <div style="block-size:100px"></div>
      <lr-virtual-list
        overscan="2"
        .rowHeight=${rowHeight}
        .items=${items}
        .renderItem=${(item: unknown) => html`<div style="block-size:${ROW_HEIGHT}px">Row ${item}</div>`}
      ></lr-virtual-list>
    </div>
  `);
  const list = scroller.querySelector('lr-virtual-list') as LyraVirtualList;
  list.scrollElement = scroller;
  await list.updateComplete;
  return { scroller, list };
}

async function targetRow(list: LyraVirtualList): Promise<HTMLElement> {
  await waitUntil(() => list.renderedRows.some((row) => row.dataset['rowIndex'] === String(TARGET_INDEX)));
  await waitUntil(() => Math.abs(list.offsetForIndex(TARGET_INDEX + 1) - list.offsetForIndex(TARGET_INDEX) - ROW_HEIGHT) <= 1);
  await list.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return list.renderedRows.find((row) => row.dataset['rowIndex'] === String(TARGET_INDEX))!;
}

for (const border of [0, 12]) {
  for (const rowHeight of [ROW_HEIGHT, 'auto'] as const) {
    for (const align of ['start', 'end'] as const) {
      it(`aligns ${rowHeight} rows to the ${align} content edge with a ${border}px external border`, async () => {
        const { scroller, list } = await borderedList(border, rowHeight);
        list.scrollToIndex(TARGET_INDEX, { align, behavior: 'auto' });
        const row = await targetRow(list);
        const contentTop = scroller.getBoundingClientRect().top + scroller.clientTop;
        const edge = align === 'start' ? row.getBoundingClientRect().top : row.getBoundingClientRect().bottom;
        const expected = align === 'start' ? contentTop : contentTop + scroller.clientHeight;
        expect(edge, `row ${align} at the visible content edge`).to.be.closeTo(expected, 1);
      });
    }
  }
}

for (const rowHeight of [ROW_HEIGHT, 'auto'] as const) {
  it(`uses nearest alignment for ${rowHeight} rows in a bordered external scroller`, async () => {
    const { scroller, list } = await borderedList(12, rowHeight);
    list.scrollToIndex(TARGET_INDEX, { align: 'auto', behavior: 'auto' });
    const row = await targetRow(list);
    const contentTop = scroller.getBoundingClientRect().top + scroller.clientTop;
    const contentBottom = scroller.getBoundingClientRect().top + scroller.clientTop + scroller.clientHeight;
    expect(row.getBoundingClientRect().top, 'the previously hidden row is fully inside the viewport').to.be.at.least(contentTop - 1);
    expect(row.getBoundingClientRect().bottom, 'the previously hidden row is fully inside the viewport').to.be.at.most(contentBottom + 1);

    const before = scroller.scrollTop;
    list.scrollToIndex(TARGET_INDEX, { align: 'auto', behavior: 'auto' });
    expect(scroller.scrollTop, 'an already visible row does not scroll').to.equal(before);
  });
}
