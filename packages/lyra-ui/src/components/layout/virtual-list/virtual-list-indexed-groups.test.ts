import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './virtual-list.js';
import type { LyraVirtualList, LyraVirtualListIndexedSource } from './virtual-list.js';

const source: LyraVirtualListIndexedSource<number> = {
  count: 1_000,
  itemAt: index => index,
  keyAt: index => index,
};

describe('indexed virtual lists with sparse group metadata', () => {
  it('aligns indexed rows in a scaled content-box external scroller with padding and borders', async () => {
    const scroller = await fixture<HTMLElement>(html`<div style="height:160px;box-sizing:content-box;padding:12px;border:4px solid black;overflow:auto;transform:scale(1.2);transform-origin:top left">
      <div style="height:60px"></div>
      <lr-virtual-list row-height="40" overscan="0" .source=${source}
        .renderItem=${(item: unknown) => html`<span>${item}</span>`}
      ></lr-virtual-list>
    </div>`);
    const list = scroller.querySelector<LyraVirtualList>('lr-virtual-list')!;
    list.scrollElement = scroller;
    await list.updateComplete;
    list.scrollToIndex(100, { align: 'start', behavior: 'auto' });
    await waitUntil(() => list.renderedRows.some(row => row.dataset['rowIndex'] === '100'));
    await nextFrame();
    const row = list.renderedRows.find(row => row.dataset['rowIndex'] === '100')!;
    const scale = scroller.getBoundingClientRect().height / scroller.offsetHeight;
    const scrollportTop = scroller.getBoundingClientRect().top + scroller.clientTop * scale;
    // Native scroll positions and painted borders may each round a layout pixel under scaling.
    expect(row.getBoundingClientRect().top).to.be.closeTo(scrollportTop, 2);
  });

  it('accounts for unsorted sparse group markers before indexed rows and retires markers outside the window', async () => {
    const list = await fixture<LyraVirtualList>(html`<lr-virtual-list
      style="--lr-virtual-list-height:160px"
      row-height="40"
      overscan="0"
      .source=${source}
      .groups=${[
        { key: 'later', label: 'Later', startIndex: 20 },
        { key: 'first', label: 'First', startIndex: 0 },
        { key: 'middle', label: 'Middle', startIndex: 10 },
      ]}
      .renderItem=${(item: unknown) => html`<span>${item}</span>`}
    ></lr-virtual-list>`);
    const first = list.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!;
    await waitUntil(() => Math.abs(list.offsetForIndex(0) - first.getBoundingClientRect().height) < 1);
    const height = first.getBoundingClientRect().height;
    expect(list.offsetForIndex(9)).to.be.closeTo(360 + height, 1);
    expect(list.offsetForIndex(10)).to.be.greaterThan(400 + height);
    expect(list.offsetForIndex(20)).to.be.greaterThan(800 + height);

    list.scrollToIndex(20, { align: 'start', behavior: 'auto' });
    await waitUntil(() => list.shadowRoot!.querySelector('[part="group"][data-group-index="20"]') !== null);
    expect(list.shadowRoot!.querySelector('[part="group"][data-group-index="0"]') === null).to.equal(true);
    await nextFrame();
    const later = list.shadowRoot!.querySelector<HTMLElement>('[part="group"][data-group-index="20"]')!;
    const row = list.shadowRoot!.querySelector<HTMLElement>('[part="row"][data-row-index="20"]')!;
    await waitUntil(() => row.getBoundingClientRect().top >= later.getBoundingClientRect().bottom - 1);
    await expect(list).to.be.accessible();
  });

  it('preserves the viewport anchor when a group above the current indexed row changes height', async () => {
    const list = await fixture<LyraVirtualList>(html`<lr-virtual-list
      style="--lr-virtual-list-height:160px"
      row-height="40"
      overscan="6"
      .source=${source}
      .groups=${[{ key: 'start', label: 'Start', startIndex: 0 }]}
      .renderItem=${(item: unknown) => html`<span>${item}</span>`}
    ></lr-virtual-list>`);
    const group = list.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!;
    await waitUntil(() => Math.abs(list.offsetForIndex(0) - group.getBoundingClientRect().height) < 1);
    list.scrollToIndex(2, { align: 'start', behavior: 'auto' });
    const base = list.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    await waitUntil(() => base.scrollTop > 80);
    await nextFrame();
    const row = list.shadowRoot!.querySelector<HTMLElement>('[part="row"][data-row-index="2"]')!;
    const beforeTop = row.getBoundingClientRect().top;
    const beforeScroll = base.scrollTop;
    const beforeHeight = group.getBoundingClientRect().height;
    group.style.height = `${beforeHeight + 40}px`;
    await waitUntil(() => base.scrollTop >= beforeScroll + 39, 'group remeasurement adjusts scroll position');
    await nextFrame();
    expect(row.getBoundingClientRect().top).to.be.closeTo(beforeTop, 1);
    expect(list.offsetForIndex(2)).to.be.closeTo(80 + beforeHeight + 40, 1);
  });
});
