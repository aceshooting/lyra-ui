import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-scroller.js';
import type { LyraScroller } from './scroller.class.js';

async function strip(): Promise<{ el: LyraScroller; seen: string[] }> {
  const seen: string[] = [];
  const wrapper = await fixture<HTMLDivElement>(html`<div
    @keydown=${(event: KeyboardEvent) => seen.push(event.key + (event.ctrlKey ? '+ctrl' : ''))}
  >
    <lr-scroller controls without-scrollbar style="inline-size:120px">
      <div style="display:flex;gap:8px;inline-size:600px"><button id="item" part="control">Item</button><span>Long content</span></div>
    </lr-scroller>
  </div>`);
  const el = wrapper.querySelector<LyraScroller>('lr-scroller')!;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="next"]')?.disabled === false, 'measured');
  return { el, seen };
}

const press = (target: Element, init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('lr-scroller interactions', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('keeps navigation and activation keys from its own controls and viewport away from ancestors', async () => {
    const { el, seen } = await strip();
    const next = el.shadowRoot!.querySelector<HTMLElement>('[part~="next"]')!;
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    for (const key of ['Enter', ' ', 'ArrowRight', 'ArrowLeft', 'Home', 'End']) {
      press(next, { key });
      press(viewport, { key });
    }
    expect(seen.join(',')).to.equal('');
  });

  it('still lets ancestors see keys from slotted content, modified keys and unrelated keys', async () => {
    const { el, seen } = await strip();
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    press(el.querySelector('#item')!, { key: 'Enter' });
    press(viewport, { key: 'ArrowRight', ctrlKey: true });
    press(viewport, { key: 'Escape' });
    expect(seen.join(',')).to.equal('Enter,ArrowRight+ctrl,Escape');
  });

  it('keeps the keyboard focus ring on the viewport while it is hovered', async () => {
    const { el } = await strip();
    el.style.setProperty('--lr-focus-ring-color', 'rgb(1, 2, 3)');
    el.style.setProperty('--lr-scroller-hover-outline-color', 'rgb(9, 9, 9)');
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    await focusByKeyboard(viewport);
    await hoverUntilMatched(viewport, 'the viewport never registered :hover');
    await waitUntil(() => viewport.matches(':focus-visible'), 'viewport must be focus-visible');
    expect(getComputedStyle(viewport).outlineColor).to.equal('rgb(1, 2, 3)');
  });

  it('leaves room around slotted items for their focus ring without changing the layout height', async () => {
    const { el } = await strip();
    const item = el.querySelector<HTMLElement>('#item')!;
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
    const ring = parseFloat(getComputedStyle(el).getPropertyValue('--lr-focus-ring-width')) || 3;
    const room = item.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
    expect(room >= ring, 'viewport extends past the item by the ring width').to.equal(true);
    const wrap = el.shadowRoot!.querySelector<HTMLElement>('.viewport-wrap')!;
    expect(Math.abs(wrap.getBoundingClientRect().height - item.getBoundingClientRect().height) < 1.5).to.equal(true);
  });
});

it('inherits scroller surface and spacing overrides', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="--lr-scroller-controls-gap: 15px; --lr-scroller-gap: 17px">
    <lr-scroller controls></lr-scroller>
  </div>`);
  const el = wrapper.querySelector('lr-scroller')!;
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).columnGap).to.equal('15px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="content"]')!).columnGap).to.equal('17px');
});

it('updates the viewport name after a host aria-label change', async () => {
  const el = await fixture<HTMLElement>(html`<lr-scroller aria-label="One">Body</lr-scroller>`);
  el.setAttribute('aria-label', 'Two');
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(el.shadowRoot!.querySelector('[part~="viewport"]')!.getAttribute('aria-label')).to.equal('Two');
});

it('accepts a programmatic accessibleLabel on the viewport', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-scroller']>(html`<lr-scroller >Body</lr-scroller>`);
  el.accessibleLabel = 'Quarterly results';
  await el.updateComplete;
  const owner = el.shadowRoot!.querySelector('[part~="viewport"]')!;
  expect(owner.getAttribute('aria-label')).to.equal('Quarterly results');
});

it('uses the default scrolling step for an empty scroll-step', async () => {
  const el = await fixture<LyraScroller>(html`<lr-scroller scroll-step=""></lr-scroller>`);
  expect(el.scrollStep).to.equal(0);
});
