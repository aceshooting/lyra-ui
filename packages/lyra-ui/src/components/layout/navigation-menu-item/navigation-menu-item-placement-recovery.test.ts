import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import '../navigation-menu/navigation-menu.js';
import type { LyraNavigationMenu } from '../navigation-menu/navigation-menu.js';
import type { LyraNavigationMenuItem } from './navigation-menu-item.js';

for (const failure of ['import', 'setup'] as const) {
  for (const opening of ['initial', 'property', 'keyboard', 'reconnect'] as const) {
    it(`closes a ${opening} navigation disclosure after positioning ${failure} fails and permits another opening`, async () => {
      const runtime = await import('../../../internal/positioner.js');
      let menu: HTMLElement | undefined;
      let failed = false, failing = true;
      __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
        if (failure === 'import' && failing) { failed = true; throw new Error('Positioning import unavailable'); }
        return { place: (...args) => {
          if (failure === 'setup' && failing) { failed = true; throw new Error('Positioning setup unavailable'); }
          return runtime.placeAnchoredSurface(...args);
        }, trackRect: runtime.trackRect };
      });
      try {
        menu = await fixture<HTMLElement>(html`<lr-navigation-menu>
          <lr-navigation-menu-item ?open=${opening === 'initial'}>Products<div slot="panel"><button>Product action</button></div></lr-navigation-menu-item>
        </lr-navigation-menu>`);
        const item = menu.querySelector<LyraNavigationMenuItem>('lr-navigation-menu-item')!;
        const trigger = item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
        if (opening === 'keyboard') { await focusByKeyboard(trigger); await sendKeys({ press: 'Enter' }); }
        else if (opening !== 'initial') {
          if (opening === 'reconnect') item.remove();
          item.open = true;
          if (opening === 'reconnect') menu.append(item);
        }
        await waitUntil(() => failed && !item.open, 'failed placement must retire the open disclosure');
        const panel = item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
        await waitUntil(() => panel.hidden);
        expect(getComputedStyle(panel).display).to.equal('none');
        expect(trigger.getAttribute('aria-expanded')).to.equal('false');
        failing = false;
        item.open = true;
        await waitUntil(() => item.open && !panel.hidden && panel.style.position !== '' && getComputedStyle(panel).visibility === 'visible');
        expect(trigger.getAttribute('aria-expanded')).to.equal('true');
        item.open = false;
        await waitUntil(() => panel.hidden);
      } finally {
        menu?.remove();
        __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
      }
    });
  }
}

for (const failure of ['import', 'setup'] as const) {
  it(`returns focus from a visible panel when repositioning ${failure} fails`, async () => {
    const runtime = await import('../../../internal/positioner.js');
    const menu = await fixture<LyraNavigationMenu>(html`<lr-navigation-menu>
      <lr-navigation-menu-item>Products<div slot="panel"><button>Product action</button></div></lr-navigation-menu-item>
    </lr-navigation-menu>`);
    const item = menu.querySelector<LyraNavigationMenuItem>('lr-navigation-menu-item')!;
    const trigger = item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
    const panel = item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    const action = item.querySelector<HTMLButtonElement>('button')!;
    await focusByKeyboard(trigger);
    await sendKeys({ press: 'Enter' });
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => action.matches(':focus'));
    let failing = true, failed = false;
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
      if (failure === 'import' && failing) { failed = true; throw new Error('Positioning import unavailable'); }
      return { place: (...args) => {
        if (failure === 'setup' && failing) { failed = true; throw new Error('Positioning setup unavailable'); }
        return runtime.placeAnchoredSurface(...args);
      }, trackRect: runtime.trackRect };
    });
    try {
      menu.distance += 1;
      await waitUntil(() => failed && !item.open && panel.hidden);
      expect(item.shadowRoot!.activeElement === trigger).to.equal(true);
      expect(trigger.getAttribute('aria-expanded')).to.equal('false');
      failing = false;
      await sendKeys({ press: 'Enter' });
      await sendKeys({ press: 'ArrowDown' });
      await waitUntil(() => item.open && action.matches(':focus'));
      expect(getComputedStyle(panel).visibility).to.equal('visible');
    } finally {
      menu.remove();
      __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
    }
  });
}

for (const replacement of ['new placement', 'stacked layout'] as const) {
  it(`preserves an open disclosure when an obsolete import fails after ${replacement}`, async () => {
    const runtime = await import('../../../internal/positioner.js');
    const menu = await fixture<LyraNavigationMenu>(html`<lr-navigation-menu>
      <lr-navigation-menu-item>Products<div slot="panel"><button>Product action</button></div></lr-navigation-menu-item>
    </lr-navigation-menu>`);
    const item = menu.querySelector<LyraNavigationMenuItem>('lr-navigation-menu-item')!;
    const panel = item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    let requested = false, rejectOld: ((error: Error) => void) | undefined;
    const events: boolean[] = [];
    item.addEventListener('lr-toggle', event => events.push(event.detail.expanded));
    __setAnchoredOverlayRuntimeLoaderForTesting(() => {
      requested = true;
      return new Promise((_resolve, reject) => { rejectOld = reject; });
    });
    try {
      item.open = true;
      await waitUntil(() => requested);
      __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({ place: runtime.placeAnchoredSurface, trackRect: runtime.trackRect }));
      if (replacement === 'new placement') menu.distance += 1;
      else {
        menu.mobileBreakpoint = '99999px';
        menu.expanded = true;
        await waitUntil(() => menu.collapsed && !item.open);
        item.open = true;
      }
      await waitUntil(() => !panel.hidden && getComputedStyle(panel).visibility === 'visible');
      rejectOld!(new Error('Obsolete positioning import failed'));
      await nextFrame();
      expect(item.open).to.equal(true);
      expect(panel.hidden).to.equal(false);
      expect(getComputedStyle(panel).visibility).to.equal('visible');
      if (replacement === 'stacked layout') expect(panel.style.position).to.equal('');
      expect(events).to.deep.equal(replacement === 'stacked layout' ? [true, false, true] : [true]);
    } finally {
      rejectOld?.(new Error('Pending test placement released'));
      menu.remove();
      __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
    }
  });
}
