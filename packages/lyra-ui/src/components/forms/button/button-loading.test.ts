import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './button.js';
import '../../overlays/dialog/dialog.js';
import type { LyraButton } from './button.class.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.class.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';

function assertSpinnerPhases(button: LyraButton, scrollContainer: HTMLElement, before: number[]): void {
  const base = button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  const spinner = button.shadowRoot!.querySelector<HTMLElement>('[part="spinner"]')!;
  const animation = spinner.getAnimations()[0];
  if (!animation) throw new Error('The loading spinner has no animation.');
  animation.pause();
  const duration = Number(animation.effect!.getTiming().duration);
  const baseRect = base.getBoundingClientRect();
  for (const phase of [0, 0.125, 0.25, 0.5, 0.75, 0.875]) {
    animation.currentTime = duration * phase;
    const spinnerRect = spinner.getBoundingClientRect();
    expect(
      [scrollContainer.scrollWidth, scrollContainer.scrollHeight],
      `scroll extents at animation phase ${phase}`
    ).to.deep.equal(before);
    expect(spinnerRect.left, `left at phase ${phase}`).to.be.at.least(baseRect.left);
    expect(spinnerRect.right, `right at phase ${phase}`).to.be.at.most(baseRect.right);
    expect(spinnerRect.top, `top at phase ${phase}`).to.be.at.least(baseRect.top);
    expect(spinnerRect.bottom, `bottom at phase ${phase}`).to.be.at.most(baseRect.bottom);
    expect(spinnerRect.left + spinnerRect.width / 2).to.be.closeTo(baseRect.left + baseRect.width / 2, 1);
    expect(spinnerRect.top + spinnerRect.height / 2).to.be.closeTo(baseRect.top + baseRect.height / 2, 1);
  }
}

describe('lr-button loading geometry', () => {
  for (const direction of ['ltr', 'rtl']) {
    for (const href of [undefined, '/account']) {
      const mode = href ? 'link' : 'button';
      it(`keeps a wide ${direction} ${mode}'s scroll extents stable throughout its spin`, async () => {
        const container = await fixture<HTMLElement>(html`
          <div dir=${direction} style="display: grid; inline-size: 430px; block-size: 42px; overflow: auto">
            <lr-button .href=${href} style="inline-size: 100%; --lr-button-size-m: 42px">Save changes</lr-button>
          </div>
        `);
        const button = container.querySelector<LyraButton>('lr-button')!;
        await button.updateComplete;
        const before = [container.scrollWidth, container.scrollHeight];
        button.loading = true;
        await button.updateComplete;
        assertSpinnerPhases(button, container, before);
      });

      it(`keeps an open dialog's scroll extents stable with a wide ${direction} loading ${mode}`, async () => {
        const dialog = await fixture<LyraDialog>(html`
          <lr-dialog label="Save changes" dir=${direction}
            style="--lr-dialog-width: 480px; --lr-duration-base: 0ms">
            <lr-button .href=${href} style="inline-size: 100%; --lr-button-size-m: 42px">Save changes</lr-button>
          </lr-dialog>
        `);
        try {
          await dialog.show();
          const button = dialog.querySelector<LyraButton>('lr-button')!;
          await button.updateComplete;
          const body = dialog.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
          const before = [body.scrollWidth, body.scrollHeight];
          button.loading = true;
          await button.updateComplete;
          assertSpinnerPhases(button, body, before);
        } finally {
          await dialog.close('api');
        }
      });
    }
  }

  it('keeps spinner part styling and glyph size centered independently of button width', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <style>lr-button::part(spinner) { color: rgb(4, 5, 6); font-size: 20px; }</style>
        <lr-button loading style="inline-size: 430px; --lr-button-spinner-duration: 2.4s">Save changes</lr-button>
      </div>
    `);
    const button = wrapper.querySelector<LyraButton>('lr-button')!;
    await button.updateComplete;
    const spinner = button.shadowRoot!.querySelector<HTMLElement>('[part="spinner"]')!;
    const animation = spinner.getAnimations()[0];
    if (!animation) throw new Error('The loading spinner has no animation.');
    animation.pause();
    animation.currentTime = 0;
    expect(getComputedStyle(spinner).color).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(spinner).animationDuration).to.equal('2.4s');
    expect(spinner.getBoundingClientRect().width).to.be.closeTo(20, 1);
    expect(spinner.getBoundingClientRect().height).to.be.closeTo(20, 1);
    expect(spinner.querySelector('svg')!.getBoundingClientRect().width).to.be.closeTo(20, 1);
  });

  it('keeps loading semantics and stops repeated spinning under reduced motion', async () => {
    try {
      await setReducedMotion('no-preference');
      const container = await fixture<HTMLElement>(html`
        <div style="display: grid; inline-size: 430px; block-size: 42px; overflow: auto">
          <lr-button loading style="inline-size: 100%; --lr-button-size-m: 42px">Save changes</lr-button>
        </div>
      `);
      const button = container.querySelector<LyraButton>('lr-button')!;
      await button.updateComplete;
      const base = button.shadowRoot!.querySelector<HTMLButtonElement>('[part~="base"]')!;
      const spinner = button.shadowRoot!.querySelector<HTMLElement>('[part="spinner"]')!;
      await setReducedMotion('reduce');
      await waitUntil(
        () => matchMedia('(prefers-reduced-motion: reduce)').matches,
        'the browser did not apply the reduced-motion preference'
      );
      await waitUntil(
        () => getComputedStyle(spinner).animationIterationCount === '1',
        'the spinner did not render its reduced-motion state'
      );
      expect(base.disabled).to.equal(true);
      expect(base.getAttribute('aria-busy')).to.equal('true');
      expect(spinner.getAttribute('aria-hidden')).to.equal('true');
      expect(getComputedStyle(spinner).animationIterationCount).to.equal('1');
      expect(parseFloat(getComputedStyle(spinner).animationDuration)).to.be.lessThan(0.01);
      expect(container.scrollWidth).to.equal(container.clientWidth);
      expect(container.scrollHeight).to.equal(container.clientHeight);
    } finally {
      await setReducedMotion('no-preference');
    }
  });
});
