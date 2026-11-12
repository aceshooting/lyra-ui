import { expect, fixture, fixtureCleanup, html, oneEvent, waitUntil } from '@open-wc/testing';
import './color-picker.js';
import type { LyraColorPicker } from './color-picker.class.js';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

afterEach(() => {
  fixtureCleanup();
  __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
});

for (const failure of ['import', 'setup'] as const) {
  it(`closes an unpositioned color panel after ${failure} fails and recovers on the next open`, async () => {
    const runtime = await import('../../../internal/positioner.js');
    let failed = false;
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
      if (failure === 'import' && !failed) {
        failed = true;
        throw new Error('Positioning chunk unavailable');
      }
      return {
        trackRect: runtime.trackRect,
        place: (...args) => {
          if (failure === 'setup' && !failed) {
            failed = true;
            throw new Error('Positioning geometry unavailable');
          }
          return runtime.placeAnchoredSurface(...args);
        },
      };
    });
    const picker = await fixture<LyraColorPicker>(html`<lr-color-picker label="Accent" value="#123456"></lr-color-picker>`);
    const trigger = picker.shadowRoot!.querySelector<HTMLButtonElement>('[part~="trigger"]')!;
    await focusByKeyboard(trigger);
    const events: string[] = [];
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      picker.addEventListener(name, () => events.push(name));
    }
    picker.show();
    await waitUntil(() => failed && !picker.open, 'unpositioned panel closes');
    await picker.updateComplete;
    expect(events).to.deep.equal(['lr-show']);
    expect(trigger.getAttribute('aria-expanded')).to.equal('false');
    expect(picker.shadowRoot!.activeElement === trigger).to.equal(true);
    expect(picker.value).to.equal('#123456');

    const shown = oneEvent(picker, 'lr-after-show');
    picker.show();
    await shown;
    expect(picker.open).to.equal(true);
    expect(trigger.getAttribute('aria-expanded')).to.equal('true');
    expect(events).to.deep.equal(['lr-show', 'lr-show', 'lr-after-show']);
    const panel = picker.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
    expect(panel.contains(picker.shadowRoot!.activeElement)).to.equal(true);
    expect(getComputedStyle(panel).visibility).to.equal('visible');
    expect(panel.getBoundingClientRect().width).to.be.greaterThan(0);

    const hidden = oneEvent(picker, 'lr-after-hide');
    picker.hide();
    await hidden;
    expect(picker.open).to.equal(false);
    expect(picker.shadowRoot!.activeElement === trigger).to.equal(true);
    expect(events).to.deep.equal(['lr-show', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']);
    expect(picker.value).to.equal('#123456');
  });
}
