import { fixture, expect, html } from '@open-wc/testing';
import '../thread-list/thread-list.js';
import type { LyraThreadList } from '../thread-list/thread-list.js';

async function nextFrame(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

it('debug row-action styling baseline', async () => {
  const threads = [{ id: 't1', title: 'Today thread', timestamp: new Date() }];
  const el = (await fixture(
    html`<lyra-thread-list style="block-size:400px" .threads=${threads} .rowActions=${['pin', 'archive', 'delete']}></lyra-thread-list>`,
  )) as LyraThreadList;
  await el.updateComplete;
  await nextFrame();
  const list = el.shadowRoot!.querySelector('lyra-virtual-list')!;
  const row = list.shadowRoot!.querySelector('lyra-conversation-item')!;
  const button = row.querySelector('[part="row-action"]') as HTMLElement;
  console.log('cursor', getComputedStyle(button).cursor);
  console.log('background', getComputedStyle(button).background);
  console.log('inline-size', getComputedStyle(button).inlineSize);
  expect(button).to.exist;
});
