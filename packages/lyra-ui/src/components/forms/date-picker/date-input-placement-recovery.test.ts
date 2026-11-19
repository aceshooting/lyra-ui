import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import './date-input.js';
import type { LyraDateInput } from './date-input.js';

for (const failure of ['import', 'setup'] as const) {
  for (const opening of ['show', 'property', 'reconnect'] as const) {
    it(`settles a ${opening} calendar opening after positioning ${failure} failure and permits a fresh opening`, async () => {
      const runtime = await import('../../../internal/positioner.js');
      const el = await fixture<LyraDateInput>(html`<lr-date-input label="Date" value="2026-07-15"></lr-date-input>`);
      const events: string[] = [];
      for (const type of ['lr-show', 'lr-after-show', 'input', 'change']) el.addEventListener(type, () => events.push(type));
      let failed = false, failing = true;
      __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
        if (failure === 'import' && failing) {
          failed = true;
          throw new Error('Positioning import unavailable');
        }
        return {
          place: (...args) => {
            if (failure === 'setup' && failing) {
              failed = true;
              throw new Error('Positioning setup unavailable');
            }
            return runtime.placeAnchoredSurface(...args);
          },
          trackRect: runtime.trackRect,
        };
      });
      try {
        if (opening === 'show') await el.show();
        else {
          if (opening === 'reconnect') el.remove();
          el.open = true;
          if (opening === 'reconnect') await fixture(el);
          else await el.updateComplete;
        }
        const popup = el.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!;
        await waitUntil(() => failed && !el.open && popup.hidden);
        expect(getComputedStyle(popup).display).to.equal('none');
        expect(popup.querySelectorAll('lr-date-picker').length).to.equal(0);
        expect(popup.getAttribute('aria-hidden')).to.equal('true');
        const expected = opening === 'show' ? ['lr-show'] : [];
        expect(events).to.deep.equal(expected);
        expect(el.value).to.equal('2026-07-15');
        failing = false;
        await el.show();
        expect(el.open).to.equal(true);
        expect(el.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!.hidden).to.equal(false);
        expect(events).to.deep.equal([...expected, 'lr-show', 'lr-after-show']);
        await el.hide();
        expect(el.open).to.equal(false);
        expect(el.value).to.equal('2026-07-15');
      } finally {
        el.remove();
        __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
      }
    });
  }
}

it('keeps a newly positioned calendar open when an obsolete runtime import rejects', async () => {
  const runtime = await import('../../../internal/positioner.js');
  const el = await fixture<LyraDateInput>(html`<lr-date-input label="Date"></lr-date-input>`);
  const events: string[] = [];
  for (const type of ['lr-show', 'lr-after-show', 'lr-hide']) el.addEventListener(type, () => events.push(type));
  let rejectOld!: (error: Error) => void, requested = false;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => {
    requested = true;
    return new Promise((_resolve, reject) => { rejectOld = reject; });
  });
  try {
    const shown = el.show();
    await waitUntil(() => requested);
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({ place: runtime.placeAnchoredSurface, trackRect: runtime.trackRect }));
    el.placement = 'top';
    await shown;
    expect(el.open).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="popup"]')!.hasAttribute('data-positioned')).to.equal(true);
    rejectOld(new Error('Obsolete positioning import failed'));
    await nextFrame();
    expect(el.open).to.equal(true);
    expect(events).to.deep.equal(['lr-show', 'lr-after-show']);
    await el.hide();
    expect(el.open).to.equal(false);
  } finally {
    rejectOld?.(new Error('Pending test placement released'));
    el.remove();
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});
