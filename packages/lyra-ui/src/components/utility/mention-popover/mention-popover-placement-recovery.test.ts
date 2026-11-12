import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import './mention-popover.js';
import type { LyraMentionPopover } from './mention-popover.js';

for (const failure of ['import', 'setup'] as const) {
  it(`declines a focus transfer after positioning ${failure} failure and permits a fresh opening`, async () => {
    const runtime = await import('../../../internal/positioner.js');
    const host = await fixture<HTMLDivElement>(html`<div><textarea aria-label="Message">Draft</textarea><lr-mention-popover></lr-mention-popover></div>`);
    const anchor = host.querySelector('textarea')!;
    const el = host.querySelector<LyraMentionPopover>('lr-mention-popover')!;
    el.anchor = anchor;
    el.items = [{ suggestionId: 'alice', label: 'Alice' }];
    await el.updateComplete;
    await focusByKeyboard(anchor);
    const events: string[] = [];
    for (const type of ['lr-mention-select', 'lr-mention-close']) el.addEventListener(type, () => events.push(type));
    let fail!: () => void;
    const blocked = new Promise<void>(resolve => { fail = resolve; });
    let failed = false, requested = false;
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
      if (!failed) {
        requested = true;
        await blocked;
        if (failure === 'import') {
          failed = true;
          throw new Error('Positioning import unavailable');
        }
      }
      return {
        place: (...args) => {
          if (failure === 'setup' && !failed) {
            failed = true;
            throw new Error('Positioning setup unavailable');
          }
          return runtime.placeAnchoredSurface(...args);
        },
        trackRect: runtime.trackRect,
      };
    });
    try {
      el.open = true;
      await el.updateComplete;
      await waitUntil(() => requested);
      const transfer = el.focusActiveOption();
      fail();
      expect(await transfer).to.equal(false);
      await waitUntil(() => !el.open && el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!.hidden);
      expect(events).to.deep.equal([]);
      expect(document.activeElement === anchor).to.equal(true);
      expect(anchor.value).to.equal('Draft');
      el.open = true;
      await el.updateComplete;
      expect(await el.focusActiveOption()).to.equal(true);
      expect(el.shadowRoot!.activeElement?.getAttribute('data-id')).to.equal('alice');
      expect(events).to.deep.equal([]);
    } finally {
      fail();
      el.remove();
      __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
    }
  });
}
