import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.js';

for (const failure of ['import', 'setup'] as const) {
  for (const opening of ['initial', 'property', 'keyboard', 'reconnect'] as const) {
    it(`closes the locale popup after ${opening} positioning ${failure} fails and allows recovery`, async () => {
      const runtime = await import('../../../internal/positioner.js');
      let el: LyraLocalePicker | undefined;
      let failed = false, failing = true;
      __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
        if (failure === 'import' && failing) { failed = true; throw new Error('Positioning import unavailable'); }
        return { place: (...args) => {
          if (failure === 'setup' && failing) { failed = true; throw new Error('Positioning setup unavailable'); }
          return runtime.placeAnchoredSurface(...args);
        }, trackRect: runtime.trackRect };
      });
      try {
        el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags .locales=${['en', 'fr']} ?open=${opening === 'initial'}></lr-locale-picker>`);
        const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
        if (opening === 'keyboard') { await focusByKeyboard(trigger); await sendKeys({ press: 'Enter' }); }
        else if (opening !== 'initial') {
          const parent = el.parentNode!;
          if (opening === 'reconnect') el.remove();
          el.open = true;
          if (opening === 'reconnect') parent.appendChild(el);
        }
        await waitUntil(() => failed && !el!.open, 'failed placement must close the locale popup');
        const list = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
        await waitUntil(() => list.hidden);
        expect(trigger.getAttribute('aria-expanded')).to.equal('false');
        expect(getComputedStyle(list).display).to.equal('none');
        failing = false;
        el.open = true;
        await waitUntil(() => el!.open && !list.hidden && getComputedStyle(list).visibility === 'visible');
        expect(trigger.getAttribute('aria-expanded')).to.equal('true');
        el.open = false;
        await waitUntil(() => list.hidden);
      } finally {
        el?.remove();
        __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
      }
    });
  }
}

it('ignores a failed obsolete import after a newer locale popup is positioned', async () => {
  const runtime = await import('../../../internal/positioner.js');
  const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags .locales=${['en', 'fr']}></lr-locale-picker>`);
  let requested = false, rejectOld: ((error: Error) => void) | undefined;
  __setAnchoredOverlayRuntimeLoaderForTesting(() => {
    requested = true;
    return new Promise((_resolve, reject) => { rejectOld = reject; });
  });
  try {
    el.open = true;
    await waitUntil(() => requested);
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({ place: runtime.placeAnchoredSurface, trackRect: runtime.trackRect }));
    el.locales = ['en', 'fr', 'de'];
    const list = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    await waitUntil(() => !list.hidden && getComputedStyle(list).visibility === 'visible');
    rejectOld!(new Error('Obsolete positioning import failed'));
    await nextFrame();
    expect(el.open).to.equal(true);
    expect(getComputedStyle(list).visibility).to.equal('visible');
    expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(3);
  } finally {
    rejectOld?.(new Error('Pending placement released'));
    el.remove();
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});

for (const failure of ['import', 'setup'] as const) {
  for (const veto of [false, true]) {
    it(`closes a visible locale popup after replacement ${failure} fails${veto ? ' despite a hide veto' : ''}`, async () => {
      const runtime = await import('../../../internal/positioner.js');
      const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags .locales=${['en', 'fr']}></lr-locale-picker>`);
      const events: string[] = [];
      el.addEventListener('lr-after-show', () => events.push('shown'));
      const onHide = (event: Event): void => {
        events.push(event.cancelable ? 'cancelable hide' : 'forced hide');
        if (veto) event.preventDefault();
      };
      el.addEventListener('lr-hide', onHide);
      el.addEventListener('lr-after-hide', () => events.push('hidden'));
      el.open = true;
      await waitUntil(() => events.includes('shown'));
      let failed = false, failing = true;
      __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
        if (failure === 'import' && failing) { failed = true; throw new Error('Positioning import unavailable'); }
        return { place: (...args) => {
          if (failure === 'setup' && failing) { failed = true; throw new Error('Positioning setup unavailable'); }
          return runtime.placeAnchoredSurface(...args);
        }, trackRect: runtime.trackRect };
      });
      try {
        el.locales = ['en', 'fr', 'de'];
        await waitUntil(() => failed && !el.open && events.includes('hidden'));
        const list = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
        expect(list.hidden).to.equal(true);
        expect(events).to.deep.equal(['shown', 'forced hide', 'hidden']);
        failing = false;
        el.open = true;
        await waitUntil(() => events.filter(event => event === 'shown').length === 2);
        expect(getComputedStyle(list).visibility).to.equal('visible');
        el.open = false;
        await el.updateComplete;
        expect(el.open).to.equal(veto);
        expect(events.includes('cancelable hide')).to.equal(true);
        if (veto) {
          expect(list.hidden).to.equal(false);
          el.removeEventListener('lr-hide', onHide);
          el.open = false;
        }
        await waitUntil(() => list.hidden);
      } finally {
        el.remove();
        __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
      }
    });
  }
}
