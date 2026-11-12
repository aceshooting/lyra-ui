import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import './tooltip.js';
import type { LyraTooltip } from './tooltip.js';

for (const failure of ['import', 'setup'] as const) {
  it('returns focus from interactive tooltip content after replacement positioning ' + failure + ' fails', async () => {
    const runtime = await import('../../../internal/positioner.js');
    const el = await fixture<LyraTooltip>(html`<lr-tooltip manual><button slot="trigger">Help</button><a href="#details">Details</a></lr-tooltip>`);
    const trigger = el.querySelector<HTMLButtonElement>('button')!;
    const action = el.querySelector<HTMLAnchorElement>('a')!;
    await el.show();
    await focusByKeyboard(action);
    await waitUntil(() => action.matches(':focus'));
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
      if (failure === 'import') throw new Error('Positioning import unavailable');
      return { place: () => { throw new Error('Positioning setup unavailable'); }, trackRect: runtime.trackRect };
    });
    try {
      el.distance += 1;
      const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
      await waitUntil(() => !el.open && popup.hidden);
      expect(document.activeElement === trigger).to.equal(true);
    } finally {
      el.remove();
      __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
    }
  });
}

for (const failure of ['import', 'setup'] as const) {
  for (const mode of ['virtual content', 'outside', 'virtual outside'] as const) {
    it(`preserves the ${mode} focus contract after positioning ${failure} fails`, async () => {
      const runtime = await import('../../../internal/positioner.js');
      const wrapper = await fixture<HTMLElement>(html`<div>
        <button id="return">Return target</button><button id="outside">Outside action</button>
        <lr-tooltip manual><button slot="trigger">Help</button><a href="#details">Details</a></lr-tooltip>
      </div>`);
      const el = wrapper.querySelector<LyraTooltip>('lr-tooltip')!;
      const returnTarget = wrapper.querySelector<HTMLButtonElement>('#return')!;
      const outside = wrapper.querySelector<HTMLButtonElement>('#outside')!;
      const action = el.querySelector<HTMLAnchorElement>('a')!;
      const popup = el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
      if (mode.startsWith('virtual')) {
        el.showAt({ x: 100, y: 100 }, { returnFocusTo: returnTarget });
        await waitUntil(() => el.open && getComputedStyle(popup).visibility === 'visible');
      } else await el.show();
      await focusByKeyboard(mode === 'virtual content' ? action : outside);
      __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
        if (failure === 'import') throw new Error('Positioning import unavailable');
        return { place: () => { throw new Error('Positioning setup unavailable'); }, trackRect: runtime.trackRect };
      });
      try {
        el.distance += 1;
        await waitUntil(() => !el.open && popup.hidden);
        expect(document.activeElement === (mode === 'virtual content' ? returnTarget : outside)).to.equal(true);
      } finally {
        wrapper.remove();
        __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
      }
    });
  }
}
