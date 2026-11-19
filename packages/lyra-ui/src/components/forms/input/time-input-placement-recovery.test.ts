import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { __setAnchoredOverlayRuntimeLoaderForTesting } from '../../../internal/anchored-overlay-runtime.js';
import './time-input.js';
import type { LyraTimeInput } from './time-input.class.js';

function expectClosed(picker: LyraTimeInput): void {
  const root = picker.shadowRoot!;
  const popup = root.querySelector<HTMLElement>('[part="popup"]')!;
  expect(picker.open).to.equal(false);
  expect(picker.hasAttribute('open')).to.equal(false);
  expect(picker.matches(':state(open)')).to.equal(false);
  expect(root.querySelector('[part="input"]')!.getAttribute('aria-expanded')).to.equal('false');
  expect(root.querySelector('[part="expand-button"]')!.getAttribute('aria-expanded')).to.equal('false');
  expect(popup.hidden).to.equal(true);
  expect(getComputedStyle(popup).display).to.equal('none');
  expect(root.querySelectorAll('[part="column"]').length).to.equal(0);
}

for (const forced of ['readonly', 'disabled', 'fieldset'] as const) {
  it(`conceals and unmounts the picker after forced close from ${forced}`, async () => {
    const fieldset = await fixture<HTMLFieldSetElement>(html`
      <fieldset><lr-time-input hour-format="24"></lr-time-input></fieldset>
    `);
    const picker = fieldset.querySelector<LyraTimeInput>('lr-time-input')!;
    await picker.show();

    if (forced === 'fieldset') fieldset.disabled = true;
    else picker[forced] = true;
    await picker.updateComplete;
    expectClosed(picker);

    if (forced === 'fieldset') fieldset.disabled = false;
    else picker[forced] = false;
    await picker.show();
    expect(picker.open).to.equal(true);
    expect(picker.shadowRoot!.querySelectorAll('[part="column"]').length).to.equal(2);
    await picker.hide();
    expectClosed(picker);
  });
}

for (const path of ['initial markup', 'show', 'reposition'] as const) {
  it(`retires the picker after failed placement from ${path} and permits reopening`, async () => {
    const runtime = await import('../../../internal/positioner.js');
    let failing = path !== 'reposition';
    let failed = false;
    let picker: LyraTimeInput | undefined;
    let afterShows = 0;
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => {
      if (failing && path === 'initial markup') {
        failed = true;
        throw new Error('Positioning runtime unavailable');
      }
      return {
        place: (...args) => {
          if (failing) {
            failed = true;
            throw new Error('Positioning setup unavailable');
          }
          return runtime.placeAnchoredSurface(...args);
        },
        trackRect: runtime.trackRect,
      };
    });
    try {
      picker = await fixture<LyraTimeInput>(html`
        <lr-time-input
          ?open=${path === 'initial markup'}
          @lr-after-show=${() => { afterShows++; }}
          @lr-hide=${(event: Event) => event.preventDefault()}
        ></lr-time-input>
      `);
      const target = picker;
      if (path === 'show') await picker.show();
      else if (path === 'reposition') {
        await picker.show();
        failing = true;
        picker.placement = 'top-end';
      }
      await waitUntil(() => failed && !target.open, 'failed placement closes the picker');
      await picker.updateComplete;
      expectClosed(picker);
      const priorAfterShows = path === 'reposition' ? 1 : 0;
      expect(afterShows).to.equal(priorAfterShows);

      failing = false;
      await picker.show();
      expect(picker.open).to.equal(true);
      const popup = picker.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!;
      expect(popup.hidden).to.equal(false);
      expect(popup.hasAttribute('data-hidden')).to.equal(false);
      expect(afterShows).to.equal(priorAfterShows + 1);
    } finally {
      picker?.remove();
      __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
    }
  });
}

it('keeps the picker open when an obsolete positioning attempt fails after replacement', async () => {
  const runtime = await import('../../../internal/positioner.js');
  const picker = await fixture<LyraTimeInput>(html`<lr-time-input></lr-time-input>`);
  let rejectOld: ((error: Error) => void) | undefined;
  let afterShows = 0;
  picker.addEventListener('lr-after-show', () => { afterShows++; });
  __setAnchoredOverlayRuntimeLoaderForTesting(() =>
    new Promise((_resolve, reject) => { rejectOld = reject; }),
  );
  try {
    const opening = picker.show();
    await waitUntil(() => rejectOld !== undefined);
    __setAnchoredOverlayRuntimeLoaderForTesting(async () => ({
      place: runtime.placeAnchoredSurface,
      trackRect: runtime.trackRect,
    }));
    picker.placement = 'top-end';
    await opening;
    rejectOld?.(new Error('Obsolete positioning runtime unavailable'));
    await nextFrame();
    const popup = picker.shadowRoot!.querySelector<HTMLElement>('[part="popup"]')!;
    expect(picker.open).to.equal(true);
    expect(popup.hidden).to.equal(false);
    expect(popup.hasAttribute('data-hidden')).to.equal(false);
    expect(afterShows).to.equal(1);
    await picker.hide();
  } finally {
    rejectOld?.(new Error('Pending test positioning released'));
    picker.remove();
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});
