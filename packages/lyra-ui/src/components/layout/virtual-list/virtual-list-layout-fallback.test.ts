import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './virtual-list.js';
import type { LyraVirtualList } from './virtual-list.class.js';

it('aligns a distant row through a padded content-box scroller inside a scaled wrapper', async () => {
  const scroller = await fixture<HTMLElement>(html`<div style="block-size:180px;box-sizing:content-box;padding-block:12px;border:4px solid black;overflow:auto">
    <style>lr-virtual-list::part(spacer) { box-sizing: content-box; }</style>
    <div style="block-size:80px"></div>
    <lr-virtual-list
      overscan="2"
      row-height="32"
      style="transform:scale(1.25);transform-origin:top left"
      .items=${Array.from({ length: 120 }, (_, index) => index)}
      .renderItem=${(item: unknown) => html`<div style="block-size:32px">Row ${item}</div>`}
    ></lr-virtual-list>
  </div>`);
  const list = scroller.querySelector('lr-virtual-list') as LyraVirtualList;
  list.scrollElement = scroller;
  await list.updateComplete;

  const targetIndex = 90;
  list.scrollToIndex(targetIndex, { align: 'start', behavior: 'auto' });
  await waitUntil(() => list.renderedRows.some((row) => row.dataset['rowIndex'] === String(targetIndex)));
  await list.updateComplete;

  const target = list.renderedRows.find((row) => row.dataset['rowIndex'] === String(targetIndex))!;
  const borderScale = scroller.getBoundingClientRect().height / scroller.offsetHeight;
  const scrollportTop = scroller.getBoundingClientRect().top + scroller.clientTop * borderScale;
  expect(target.getBoundingClientRect().top).to.be.closeTo(scrollportTop, 1);
  expect(list.offsetForIndex(targetIndex + 1) - list.offsetForIndex(targetIndex)).to.equal(32);
});
