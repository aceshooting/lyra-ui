import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import './tooltip.js';
import type { LyraTooltip } from './tooltip.js';

for (const failure of ['import', 'setup'] as const) {
  for (const veto of [false, true]) {
    it(`closes an already visible tooltip after positioning ${failure} fails${veto ? ' despite a hide veto' : ''} and recovers`, async () => {
      const runtime = await import('../../../internal/positioner.js');
      const el = await fixture<LyraTooltip>(html`<lr-tooltip manual content="Helpful detail"><button slot="trigger">Help</button></lr-tooltip>`);
      await el.show();
      const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
      expect(getComputedStyle(popup).visibility).to.equal('visible');
      let failed = false, failing = true;
      if (veto) el.addEventListener('lr-hide', event => event.preventDefault());
      __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
        if (failure === 'import' && failing) { failed = true; throw new Error('Positioning import unavailable'); }
        return { place: (...args) => {
          if (failure === 'setup' && failing) { failed = true; throw new Error('Positioning setup unavailable'); }
          return runtime.placeAnchoredSurface(...args);
        }, trackRect: runtime.trackRect };
      });
      try {
        el.distance += 1;
        await waitUntil(() => failed && !el.open && popup.hidden, 'failed replacement geometry must close the tooltip');
        expect(getComputedStyle(popup).display).to.equal('none');
        failing = false;
        await el.show();
        expect(el.open).to.equal(true);
        expect(getComputedStyle(popup).visibility).to.equal('visible');
      } finally {
        el.remove();
        __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
      }
    });
  }
}

it('ignores failed obsolete geometry after a newer tooltip placement is visible', async () => {
  const runtime = await import('../../../internal/positioner.js');
  const el = await fixture<LyraTooltip>(html`<lr-tooltip manual content="Helpful detail"><button slot="trigger">Help</button></lr-tooltip>`);
  await el.show();
  let requested = false, rejectOld: ((error: Error) => void) | undefined;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => {
    requested = true;
    return new Promise((_resolve, reject) => { rejectOld = reject; });
  });
  try {
    el.distance += 1;
    await waitUntil(() => requested);
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({ place: runtime.placeAnchoredSurface, trackRect: runtime.trackRect }));
    el.distance += 1;
    const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    await waitUntil(() => getComputedStyle(popup).visibility === 'visible');
    rejectOld!(new Error('Obsolete positioning import failed'));
    await nextFrame();
    expect(el.open).to.equal(true);
    expect(getComputedStyle(popup).visibility).to.equal('visible');
  } finally {
    rejectOld?.(new Error('Pending placement released'));
    el.remove();
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});

for (const failure of ['import', 'setup'] as const) {
  it(`settles the initial tooltip opening once when positioning ${failure} fails`, async () => {
    const el = await fixture<LyraTooltip>(html`<lr-tooltip manual content="Helpful detail"><button slot="trigger">Help</button></lr-tooltip>`);
    const runtime = await import('../../../internal/positioner.js');
    const events: string[] = [];
    el.addEventListener('lr-after-show', () => events.push('shown'));
    el.addEventListener('lr-after-hide', () => events.push('hidden'));
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
      if (failure === 'import') throw new Error('Positioning import unavailable');
      return { place: () => { throw new Error('Positioning setup unavailable'); }, trackRect: runtime.trackRect };
    });
    try {
      await el.show();
      await waitUntil(() => !el.open && events.includes('hidden'));
      expect(events).to.deep.equal(['hidden']);
      expect(el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!.hidden).to.equal(true);
    } finally {
      el.remove();
      __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
    }
  });
}
