import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraVirtualList } from './virtual-list.class.js';
import '../../lr-virtual-list.js';

it('re-reads an owner Window viewport after the window resizes', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe title="List resize realm" style="width:320px;height:200px"></iframe>`);
  const view = frame.contentWindow!;
  const doc = frame.contentDocument!;
  doc.body.style.margin = '0';
  const element = document.createElement('lr-virtual-list') as LyraVirtualList;
  element.rowHeight = 20;
  element.items = Array.from({ length: 500 }, (_, index) => index);
  element.renderItem = (item) => html`Row ${item}`;
  element.scrollElement = view;
  doc.body.append(element);
  await element.updateComplete;
  await waitUntil(() => element.renderedRows.length > 0);
  const before = element.renderedRows.length;
  frame.style.height = '600px';
  view.dispatchEvent(new view.Event('resize'));
  await waitUntil(() => element.renderedRows.length > before, 'taller window did not render more rows');
  expect(element.renderedRows.length).to.be.greaterThan(before);
  element.remove();
});
