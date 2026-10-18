import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import './chat-viewport.js';
import '../../layout/virtual-list/virtual-list.js';
import type { LyraChatViewport } from './chat-viewport.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
expectDevWarning('virtual-list-scroll-scaling');

async function settle(host: LyraChatViewport, list: LyraVirtualList): Promise<void> {
  for (let i = 0; i < 8; i++) { await host.updateComplete; await list.updateComplete; await nextFrame(); }
}
it('follows logical growth beyond one million rows while physical extent stays bounded', async () => {
  let reads = 0;
  const source = (count: number) => ({ count, itemAt: (index: number) => { reads++; return index; }, keyAt: (index: number) => index, indexOfKey: (key: string | number) => Number(key) });
  const host = await fixture<LyraChatViewport>(html`<lr-chat-viewport style="height:240px"><lr-virtual-list
    row-height="48" .source=${source(1000000)} .renderItem=${(item: unknown) => html`<div style="height:48px">${item}</div>`}
  ></lr-virtual-list></lr-chat-viewport>`);
  const list = host.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await settle(host, list);
  host.scrollToBottom();
  await settle(host, list);
  expect(list.shadowRoot!.querySelector('[data-row-index="999999"]') !== null).to.equal(true);
  const physicalExtent = (list.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement).style.height;
  let scrolls = 0;
  const scrollToIndex = list.scrollToIndex.bind(list);
  list.scrollToIndex = (index, options) => { scrolls++; scrollToIndex(index, options); };
  reads = 0;
  list.source = source(1001000);
  await settle(host, list);
  const mounted = list.shadowRoot!.querySelectorAll('[part="row"]').length;
  recordScaleMeasurement('lr-chat-viewport', 'n=1000000 append1000', { reads, mountedRows: mounted, scrollHeight: list.scrollContainer!.scrollHeight, scrolls, following: Number(host.follow), count: Number(list.shadowRoot!.querySelector('[part="spacer"]')!.getAttribute('data-item-count')) });
  expect(list.shadowRoot!.querySelector('[data-row-index="1000999"]') !== null).to.equal(true);
  expect((list.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement).style.height).to.equal(physicalExtent);
  expect(reads).to.be.lessThan(200);
  expect(mounted).to.be.lessThan(40);
  list.source = source(900000);
  await settle(host, list);
  expect(host.follow).to.equal(true);
  expect(list.shadowRoot!.querySelector('[data-row-index="899999"]') !== null).to.equal(true);
});

it('keeps user-released follow and unread counts through keyless growth, shrink, replacement and reconnect', async () => {
  const source = { count: 1000000, itemAt: (index: number) => index, keyAt: (index: number) => index };
  const host = await fixture<LyraChatViewport>(html`<lr-chat-viewport style="height:240px" unread-start-index="999990"><lr-virtual-list
    row-height="48" .source=${source} .renderItem=${(item: unknown) => html`<div style="height:48px">${item}</div>`}
  ></lr-virtual-list></lr-chat-viewport>`);
  const list = host.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await settle(host, list);
  const base = list.scrollContainer!;
  base.dispatchEvent(new WheelEvent('wheel', { bubbles: true, composed: true }));
  base.scrollTop = 0;
  base.dispatchEvent(new Event('scroll'));
  await settle(host, list);
  expect(host.follow).to.equal(false);
  source.count += 1000;
  list.loading = true;
  list.requestUpdate();
  await settle(host, list);
  expect(host.follow).to.equal(false);
  expect(base.scrollTop).to.equal(0);
  expect(host.shadowRoot!.querySelector('[part="jump-pill"]')!.textContent).to.include('1,010');
  source.count = 999995;
  list.requestUpdate();
  await settle(host, list);
  expect(host.shadowRoot!.querySelector('[part="jump-pill"]')!.textContent).to.include('5');
  list.source = { ...source, count: 1000000 };
  await settle(host, list);
  expect(host.shadowRoot!.querySelector('[part="jump-pill"]')!.textContent).to.include('10');
  const parent = host.parentElement!;
  host.remove();
  list.source = { ...source, count: 1000090 };
  parent.append(host);
  await settle(host, list);
  expect(host.follow).to.equal(false);
  expect(host.shadowRoot!.querySelector('[part="jump-pill"]')!.textContent).to.include('100');
});
