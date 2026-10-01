import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraVirtualList } from './virtual-list.class.js';
import './virtual-list.js';

const TARGET = 100;
const ROW_HEIGHT = 40;

async function scaledList(scaling: string, border: number, rowHeight: number | 'auto') {
  const scroller = await fixture<HTMLElement>(html`
    <div style=${`block-size:200px;overflow:auto;border:${border}px solid black;${scaling}`}>
      <div style="block-size:100px"></div>
      <lr-virtual-list
        overscan="2"
        .rowHeight=${rowHeight}
        .items=${Array.from({ length: 200 }, (_, index) => index)}
        .renderItem=${(item: unknown) => html`<div style="block-size:40px">Row ${item}</div>`}
      ></lr-virtual-list>
    </div>
  `);
  const list = scroller.querySelector('lr-virtual-list') as LyraVirtualList;
  list.scrollElement = scroller;
  await list.updateComplete;
  return { scroller, list };
}

async function targetRow(list: LyraVirtualList): Promise<HTMLElement> {
  await waitUntil(() => list.renderedRows.some((row) => row.dataset['rowIndex'] === String(TARGET)));
  await waitUntil(() => Math.abs(list.offsetForIndex(TARGET + 1) - list.offsetForIndex(TARGET) - ROW_HEIGHT) <= 1);
  await list.updateComplete;
  return list.renderedRows.find((row) => row.dataset['rowIndex'] === String(TARGET))!;
}

function renderedContentEdges(scroller: HTMLElement): { top: number; bottom: number } {
  const scale = scroller.getBoundingClientRect().height / scroller.offsetHeight;
  const top = scroller.getBoundingClientRect().top + scroller.clientTop * scale;
  return { top, bottom: top + scroller.clientHeight * scale };
}

for (const scaling of ['transform:scale(1.5);transform-origin:top left', 'zoom:1.5'] as const) {
  for (const border of [0, 12]) {
    for (const rowHeight of [ROW_HEIGHT, 'auto'] as const) {
      for (const align of ['start', 'end'] as const) {
        it(`aligns ${rowHeight} rows to the rendered ${align} edge with ${scaling} and ${border}px border`, async () => {
          const { scroller, list } = await scaledList(scaling, border, rowHeight);
          list.scrollToIndex(TARGET, { align, behavior: 'auto' });
          const row = await targetRow(list);
          const edge = renderedContentEdges(scroller);
          expect(align === 'start' ? row.getBoundingClientRect().top : row.getBoundingClientRect().bottom)
            .to.be.closeTo(edge[align === 'start' ? 'top' : 'bottom'], 1);
        });
      }
    }
  }
  for (const rowHeight of [ROW_HEIGHT, 'auto'] as const) {
    it(`keeps the nearest fully visible row still with ${scaling} and ${rowHeight} rows`, async () => {
      const { scroller, list } = await scaledList(scaling, 12, rowHeight);
      list.scrollToIndex(TARGET, { align: 'auto', behavior: 'auto' });
      const row = await targetRow(list);
      const edge = renderedContentEdges(scroller);
      expect(row.getBoundingClientRect().top).to.be.at.least(edge.top - 1);
      expect(row.getBoundingClientRect().bottom).to.be.at.most(edge.bottom + 1);
      const before = scroller.scrollTop;
      list.scrollToIndex(TARGET, { align: 'auto', behavior: 'auto' });
      expect(scroller.scrollTop).to.be.closeTo(before, 0.01);
    });
  }
}

for (const scaling of ['transform:scale(1.25);transform-origin:top left', 'zoom:1.25'] as const) {
  it(`retains fractional border and viewport geometry with ${scaling}`, async () => {
    const { scroller, list } = await scaledList(scaling, 1.25, ROW_HEIGHT);
    scroller.style.blockSize = '200.25px';
    list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
    const row = await targetRow(list);
    const contentTop = scroller.getBoundingClientRect().top +
      Number.parseFloat(getComputedStyle(scroller).borderTopWidth) * 1.25;
    expect(row.getBoundingClientRect().top).to.be.closeTo(contentTop, 1);
    expect(scroller.scrollTop).to.be.closeTo(100 + list.offsetForIndex(TARGET), 1);
  });
}

it('converts a differently scaled list inside an unscaled Element scroller', async () => {
  const { scroller, list } = await scaledList('', 4, ROW_HEIGHT);
  list.style.transform = 'scale(1.25)';
  list.style.transformOrigin = 'top left';
  list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
  const row = await targetRow(list);
  expect(row.getBoundingClientRect().top).to.be.closeTo(renderedContentEdges(scroller).top, 1);
});

it('retains a distinct near-unit list scale across a distant scroll target', async () => {
  const { scroller, list } = await scaledList('zoom:1.25', 1.25, ROW_HEIGHT);
  list.style.transform = 'scale(1.002)';
  list.style.transformOrigin = 'top left';
  list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
  const row = await targetRow(list);
  const edge = scroller.getBoundingClientRect().top + 1;
  expect(row.getBoundingClientRect().top).to.be.closeTo(edge, 1);
});

it('accounts for the individual scale property inside the scroller', async () => {
  const { scroller, list } = await scaledList('', 4, ROW_HEIGHT);
  list.style.scale = '1 1.25';
  list.style.transformOrigin = 'top left';
  list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
  const row = await targetRow(list);
  expect(row.getBoundingClientRect().top).to.be.closeTo(renderedContentEdges(scroller).top, 1);
});

it('uses live scale geometry after a transform changes', async () => {
  const { scroller, list } = await scaledList('', 4, ROW_HEIGHT);
  list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
  await targetRow(list);
  list.style.transform = 'scale(1.25)';
  list.style.transformOrigin = 'top left';
  list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
  const row = await targetRow(list);
  expect(row.getBoundingClientRect().top).to.be.closeTo(renderedContentEdges(scroller).top, 1);
});

it('ignores a non-rendered slot scale while retaining its rendered wrapper scale', async () => {
  const { scroller, list } = await scaledList('', 4, ROW_HEIGHT);
  const wrapper = document.createElement('div');
  wrapper.style.transform = 'scale(1.25)';
  wrapper.style.transformOrigin = 'top left';
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  const slot = document.createElement('slot');
  slot.style.scale = '1.25';
  shadow.append(slot);
  scroller.insertBefore(wrapper, list);
  wrapper.append(host);
  host.append(list);
  list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
  const row = await targetRow(list);
  expect(row.getBoundingClientRect().top).to.be.closeTo(renderedContentEdges(scroller).top, 1);
});

it('includes a scaled ancestor in Element scroller geometry and preserves horizontal scroll', async () => {
  const { scroller, list } = await scaledList('', 4, ROW_HEIGHT);
  const wrapper = document.createElement('div');
  wrapper.style.transform = 'scale(1.25)';
  wrapper.style.transformOrigin = 'top left';
  scroller.parentNode!.insertBefore(wrapper, scroller);
  wrapper.append(scroller);
  scroller.style.inlineSize = '150px';
  scroller.firstElementChild!.setAttribute('style', 'block-size:100px;inline-size:400px');
  scroller.scrollLeft = 30;
  const horizontalScroll = scroller.scrollLeft;
  list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
  const row = await targetRow(list);
  expect(row.getBoundingClientRect().top).to.be.closeTo(renderedContentEdges(scroller).top, 1);
  expect(scroller.scrollLeft).to.equal(horizontalScroll);
});

for (const scaling of ['transform:scale(1.5)', 'zoom:1.5'] as const) {
  for (const rowHeight of [ROW_HEIGHT, 'auto'] as const) {
    it(`aligns ${rowHeight} rows with ${scaling} to the owner Window`, async () => {
      const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Scaled list scroll realm" style="width:320px;height:200px"></iframe>`);
      const view = frame.contentWindow!;
      const doc = frame.contentDocument!;
      doc.body.style.margin = '0';
      const prefix = doc.createElement('div');
      prefix.style.height = '60px';
      doc.body.append(prefix);
      const wrapper = doc.createElement('div');
      if (scaling.startsWith('transform')) wrapper.style.transform = 'scale(1.5)';
      else wrapper.style.zoom = '1.5';
      wrapper.style.transformOrigin = 'top left';
      const list = document.createElement('lr-virtual-list') as LyraVirtualList;
      list.rowHeight = rowHeight;
      list.items = Array.from({ length: 200 }, (_, index) => index);
      list.renderItem = (item) => html`<div style="block-size:40px">Row ${item}</div>`;
      list.scrollElement = view;
      wrapper.append(list);
      doc.body.append(wrapper);
      await list.updateComplete;
      const parentScroll = window.scrollY;
      list.scrollToIndex(TARGET, { align: 'start', behavior: 'auto' });
      const row = await targetRow(list);
      expect(row.getBoundingClientRect().top).to.be.closeTo(0, 1);
      expect(window.scrollY).to.equal(parentScroll);
      list.remove();
    });
  }
}
