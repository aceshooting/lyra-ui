import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import '../../lr-span-waterfall.js';
import type { LyraSpanWaterfall } from '../../lr-span-waterfall.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const SPANS = [
  { id: 'root', name: 'Root', kind: 'agent', startMs: 0, endMs: 100, status: 'success' },
  { id: 'search', name: 'Search', kind: 'tool', startMs: 10, endMs: 50, status: 'success' },
] as const;

it('ignores modified and composing keys on the bar list without cancelling them', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`);
  const list = el.shadowRoot!.querySelector('[role="list"]') as HTMLElement;
  for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }]) {
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true, ...init });
    list.dispatchEvent(event);
    expect(event.defaultPrevented).to.equal(false);
  }
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-id="root"]')!.getAttribute('tabindex')).to.equal('0');
  const plain = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true, cancelable: true });
  list.dispatchEvent(plain);
  expect(plain.defaultPrevented).to.equal(true);
});

it('paints the active row and bars with system-colour edges under forced colors', async () => {
  try {
    await setForcedColors('active');
    const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall active-span-id="root" .spans=${SPANS}></lr-span-waterfall>`);
    const row = el.shadowRoot!.querySelector('[part="row"][data-active]') as HTMLElement;
    const bar = el.shadowRoot!.querySelector('[part="bar"]') as HTMLElement;
    expect(getComputedStyle(row).outlineStyle).to.equal('solid');
    expect(getComputedStyle(bar).outlineStyle).to.equal('solid');
  } finally {
    await setForcedColors('none');
  }
});

it('moves focus to a visible bar when the view window hides the focused one', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`);
  const bar = el.shadowRoot!.querySelector('[data-id="search"]') as HTMLElement;
  await focusByKeyboard(bar);
  el.viewStartMs = 60;
  el.viewEndMs = 100;
  await el.updateComplete;
  const active = el.shadowRoot!.activeElement;
  expect(active !== null && active !== bar && (active as HTMLElement).dataset['id'] === 'root').to.equal(true);
});

it('keeps focus on the remaining content when the final action disappears', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .spans=${SPANS}></lr-span-waterfall>`);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!);
  el.spans = [];
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

it('projects the requested span window and keeps the selected span when the cap shrinks', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall .spans=${SPANS} active-span-id="search"></lr-span-waterfall>`);
  const ids = () => Array.from(el.shadowRoot!.querySelectorAll('[part="bar"]'), bar => bar.getAttribute('data-id'));
  expect(ids()).to.deep.equal(['root', 'search']);
  el.setAttribute('max-nodes', '1');
  await el.updateComplete;
  expect(ids()).to.deep.equal(['search']);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.include('1');
});

it('applies card and plain frames and reflects compact density', async () => {
  const el = await fixture<HTMLElement & { updateComplete: Promise<boolean>; frame: string; size: string }>(html`<lr-span-waterfall></lr-span-waterfall>`);
  el.frame = 'card';
  el.size = 's';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(el.getAttribute('size')).to.equal('s');
  expect(getComputedStyle(base).borderTopStyle).to.equal('solid');
  el.frame = 'plain';
  await el.updateComplete;
  expect(getComputedStyle(base).borderTopWidth).to.equal('0px');
});
