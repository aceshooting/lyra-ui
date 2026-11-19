import { expect, fixture, html } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import './slider.js';
import '../checkbox/checkbox.js';
import '../switch/switch.js';

for (const direction of ['ltr', 'rtl']) {
  for (const value of [0, 100]) {
    it(`contains an unfocused slider at ${value} in ${direction}`, async () => {
      const frame = await fixture<HTMLDivElement>(html`<div dir=${direction} style="width: 120px; overflow: auto">
        <lr-slider value=${value} with-tooltip .valueFormatter=${() => 'A long formatted value'}></lr-slider>
      </div>`);
      const slider = frame.querySelector('lr-slider')!;
      const thumb = slider.shadowRoot!.querySelector<HTMLElement>('[role="slider"]')!;
      const rect = thumb.getBoundingClientRect();
      const bounds = frame.getBoundingClientRect();
      const hitSize = Number.parseFloat(getComputedStyle(thumb, '::before').inlineSize);
      const center = (rect.left + rect.right) / 2;
      expect(center - hitSize / 2).to.be.at.least(bounds.left - 0.5);
      expect(center + hitSize / 2).to.be.at.most(bounds.right + 0.5);
      expect(frame.scrollWidth).to.equal(frame.clientWidth);
      const tooltip = slider.shadowRoot!.querySelector<HTMLElement>('[part~="tooltip"]')!;
      expect(tooltip.getClientRects().length).to.equal(0);
      await focusByKeyboard(thumb);
      await slider.updateComplete;
      expect(tooltip.getClientRects().length).to.equal(1);
    });
  }
}

it('contains scaled vertical hit targets at both track endpoints', async () => {
  const slider = await fixture(html`<lr-slider orientation="vertical" range min-value="0" max-value="100"
    style="--thumb-height: 40px; --lr-slider-track-length: 120px"></lr-slider>`);
  const root = slider.shadowRoot!;
  const base = root.querySelector('[part~="base"]')!.getBoundingClientRect();
  const minimum = root.querySelector('[part~="thumb-min"]')!.getBoundingClientRect();
  const maximum = root.querySelector('[part~="thumb-max"]')!.getBoundingClientRect();
  expect(minimum.bottom).to.be.at.most(base.bottom + 0.5);
  expect(maximum.top).to.be.at.least(base.top - 0.5);
  expect(root.querySelector('[part="track"]')!.getBoundingClientRect().height).to.be.greaterThan(0);
});

for (const [name, part] of [['slider', 'thumb'], ['checkbox', 'box'], ['switch', 'track']]) {
  it(`${name} uses the shared interaction transition`, async () => {
    const host = await fixture(`<lr-${name} style="--lr-transition-interactive: opacity 0.42s"></lr-${name}>`);
    const surface = host.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;
    expect(getComputedStyle(surface).transitionProperty.split(', ')).to.include('opacity');
  });
}

it('transitions the slider press ring and stops the transition under reduced motion', async () => {
  try {
    const slider = await fixture(html`<lr-slider data-lr-theme-scope style="--lr-transition-fast: 0.42s"></lr-slider>`);
    const thumb = slider.shadowRoot!.querySelector<HTMLElement>('[part~="thumb"]')!;
    expect(getComputedStyle(thumb).transitionProperty.split(', ')).to.include('box-shadow');
    await setReducedMotion('reduce');
    expect(getComputedStyle(thumb).transitionDuration).to.equal('0s');
  } finally {
    await setReducedMotion('no-preference');
  }
});
