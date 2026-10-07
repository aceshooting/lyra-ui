import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './scroller.js';
import type { LyraScroller } from './scroller.class.js';

describe('scroller controls at an edge', () => {
  it('moves focus to the viewport instead of dropping it when the focused control disables', async () => {
    const el = await fixture<LyraScroller>(html`<lr-scroller controls label="Items" style="inline-size: 100px">
      <div style="inline-size: 500px">wide content</div></lr-scroller>`);
    const previous = el.shadowRoot!.querySelector('[part~="previous"]') as HTMLButtonElement;
    const next = el.shadowRoot!.querySelector('[part~="next"]') as HTMLButtonElement;
    await waitUntil(() => previous.disabled && !next.disabled, 'edges settle');
    await focusByKeyboard(next);
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    viewport.scrollTo({ left: viewport.scrollWidth });
    await waitUntil(() => next.disabled, 'the end edge is reached');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(el.shadowRoot!.activeElement === viewport).to.equal(true);
  });
});
