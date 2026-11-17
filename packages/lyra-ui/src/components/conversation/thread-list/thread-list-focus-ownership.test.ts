import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraThreadList } from './thread-list.js';
import './thread-list.js';

it('preserves an outside focus transfer before a pending virtual boundary navigation finishes', async () => {
  const threads = Array.from({ length: 60 }, (_, index) => ({
    id: `thread-${index}`,
    title: `Thread ${index}`,
  }));
  const firstId = threads[0]!.id;
  const lastId = threads[threads.length - 1]!.id;
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <style>
      lr-thread-list::part(row) { block-size: 48px; overflow: hidden; }
    </style>
    <lr-thread-list style="block-size:200px;inline-size:360px" grouping="none"
      .threads=${threads}></lr-thread-list>
    <button type="button">Continue outside the list</button>
  </div>`);
  const element = wrapper.querySelector<LyraThreadList>('lr-thread-list')!;
  const outside = wrapper.querySelector<HTMLButtonElement>('button')!;
  await element.updateComplete;
  const list = element.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list')!;
  await waitUntil(() => element.itemElement(firstId) !== null, 'the first thread is rendered', { timeout: 3000 });
  await twoFrames();
  await list.updateComplete;
  expect(element.itemElement(lastId) === null, 'the final thread starts outside the rendered window').to.equal(true);
  const first = element.itemElement(firstId)!;
  await first.updateComplete;
  await focusByKeyboard(first.shadowRoot!.querySelector<HTMLElement>('[part="select-button"]')!);

  const focusOrder: string[] = [];
  const recordFocus = (event: FocusEvent) => {
    const path = event.composedPath();
    if (path.includes(outside)) focusOrder.push('outside');
    else {
      const destination = element.itemElement(lastId);
      if (destination && path.includes(destination)) focusOrder.push('destination');
    }
  };
  wrapper.addEventListener('focusin', recordFocus);
  let nativeKey = false;
  let navigationHandled = false;
  let destinationHadNotFocused = false;
  let transferredSynchronously = false;
  element.addEventListener('keydown', event => {
    if (event.key !== 'End') return;
    nativeKey = event.isTrusted;
    navigationHandled = event.defaultPrevented;
    destinationHadNotFocused = !focusOrder.includes('destination') &&
      element.itemElement(lastId)?.matches(':focus-within') !== true;
    // A consumer can transfer focus in the same native key event after list navigation handled it.
    outside.focus({ preventScroll: true });
    transferredSynchronously = document.activeElement === outside;
  }, { once: true });

  await sendKeys({ press: 'End' });
  expect(nativeKey, 'the browser dispatched the boundary key').to.equal(true);
  expect(navigationHandled, 'the internal list handler ran before the consumer listener').to.equal(true);
  expect(destinationHadNotFocused, 'outside focus was transferred before the destination received focus').to.equal(true);
  expect(transferredSynchronously, 'the consumer moved focus within the key event').to.equal(true);
  await waitUntil(() => element.itemElement(lastId) !== null, 'the pending navigation rendered its destination', { timeout: 3000 });
  await list.updateComplete;
  await twoFrames();
  expect(focusOrder, 'the delayed navigation must not reclaim focus after the outside transfer').to.deep.equal(['outside']);
  expect(document.activeElement === outside, 'outside focus survives destination rendering').to.equal(true);
  wrapper.removeEventListener('focusin', recordFocus);

  let outsideActivations = 0;
  outside.addEventListener('click', () => { outsideActivations += 1; });
  await sendKeys({ press: 'Enter' });
  expect(outsideActivations, 'native activation reaches the control that owns focus').to.equal(1);

  const last = element.itemElement(lastId)!;
  await last.updateComplete;
  await focusByKeyboard(last.shadowRoot!.querySelector<HTMLElement>('[part="select-button"]')!);
  await sendKeys({ press: 'Home' });
  await waitUntil(() => element.itemElement(firstId)?.shadowRoot!.activeElement?.getAttribute('part') === 'select-button',
    'a fresh navigation can return to the first thread', { timeout: 3000 });
  await sendKeys({ press: 'End' });
  await waitUntil(() => element.itemElement(lastId)?.shadowRoot!.activeElement?.getAttribute('part') === 'select-button',
    'a fresh boundary navigation can still focus the final thread', { timeout: 3000 });
});
