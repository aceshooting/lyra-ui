import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-span-waterfall.js';
import type { LyraSpanWaterfall } from '../../lr-span-waterfall.js';
import type { LyraSpan } from '../trace-tree/span.js';

const SPANS: LyraSpan[] = [
  { id: 'early', name: 'Early', kind: 'llm', status: 'success', startMs: 0, endMs: 100 },
  { id: 'late', name: 'Late', kind: 'tool', status: 'success', startMs: 900, endMs: 1000 },
];
const bars = (el: LyraSpanWaterfall) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="bar"]')];

it('reports that no key can be revealed without a source', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`);
  expect(await el.revealSourceKey('early')).to.equal(false);
  expect(bars(el).length).to.equal(2);
});

it('claims no navigation key while the view window hides every span', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .spans=${SPANS} view-start-ms="300" view-end-ms="600"></lr-span-waterfall>`);
  expect(bars(el).every((bar) => bar.hidden)).to.equal(true);
  const list = el.shadowRoot!.querySelector<HTMLElement>('[role="list"]')!;
  const key = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
  list.dispatchEvent(key);
  expect(key.defaultPrevented).to.equal(false);
});

it('moves and selects only among bars inside a narrowed view window', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`);
  await focusByKeyboard(bars(el)[1]!);
  el.viewStartMs = 0;
  el.viewEndMs = 500;
  await el.updateComplete;
  expect(bars(el).map((bar) => bar.hidden)).to.deep.equal([false, true]);
  expect(bars(el)[0]!.tabIndex, 'the tab stop moves off the hidden bar').to.equal(0);
  await focusByKeyboard(bars(el)[0]!);
  await sendKeys({ press: 'End' });
  expect(el.shadowRoot!.activeElement === bars(el)[0]).to.equal(true);
  const selected = oneEvent(el, 'lr-span-select');
  await sendKeys({ press: 'Enter' });
  expect((await selected).detail.spanId).to.equal('early');
});
