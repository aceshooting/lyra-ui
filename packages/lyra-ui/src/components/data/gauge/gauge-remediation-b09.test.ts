import { setForcedColors } from '../../../../test/wtr-media.js';
import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-gauge.js';
import type { LyraGauge } from '../../lr-gauge.js';

describe('gauge remediation', () => {
  it('ignores malformed thresholds instead of throwing', async () => {
    const bad = [null, 7, 'x', [], { at: 'a', variant: 'danger' }, { at: 10, variant: 'nope' }, { at: 20, variant: 'success' }];
    const el = await fixture<LyraGauge>(html`<lr-gauge value="50" .thresholds=${bad as never}></lr-gauge>`);
    expect(el.getAttribute('data-effective-variant')).to.equal('success');
    el.thresholds = 5 as never;
    await el.updateComplete;
    expect(el.getAttribute('data-effective-variant')).to.equal('brand');
    el.thresholds = null as never;
    await el.updateComplete;
    expect(el.getAttribute('data-effective-variant')).to.equal('brand');
  });

  it('never exceeds its container inline size', async () => {
    const el = await fixture<LyraGauge>(html`<div style="inline-size:40px"><lr-gauge value="5"></lr-gauge></div>`);
    const gauge = el.querySelector('lr-gauge')!;
    const { width, height } = gauge.getBoundingClientRect();
    expect(width).to.be.at.most(40.5);
    expect(height).to.be.closeTo(width, 0.5);
  });
});

for (const direction of ['ltr', 'rtl']) {
  it(`keeps localized linear captions proportional across allocations (${direction})`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div dir=${direction}>
      <lr-gauge shape="linear" locale="de-DE" value="1234.5" max="2000" label="Datenträgerauslastung"
        .strings=${{ gaugeValueLabel: '{label}: {value}' }}></lr-gauge>
    </div>`);
    const gauge = wrapper.querySelector('lr-gauge')!;
    const label = gauge.shadowRoot!.querySelector<SVGTextElement>('[part="label"]')!;
    const value = gauge.shadowRoot!.querySelector<SVGTextElement>('[part="value"]')!;
    const track = gauge.shadowRoot!.querySelector<SVGLineElement>('[part="track"]')!;
    expect(value.textContent).to.equal('1.234,5');
    expect(gauge.shadowRoot!.querySelector('title')?.textContent).to.equal('Datenträgerauslastung: 1.234,5');
    const defaultWidth = gauge.getBoundingClientRect().width;
    const labelWidth = label.getBoundingClientRect().width;
    const valueWidth = value.getBoundingClientRect().width;
    for (const width of [defaultWidth, 110, 320]) {
      wrapper.style.inlineSize = `${width}px`;
      gauge.style.inlineSize = `${width}px`;
      const bounds = gauge.getBoundingClientRect();
      const labelBounds = label.getBoundingClientRect();
      const valueBounds = value.getBoundingClientRect();
      expect(track.getBoundingClientRect().width).to.be.closeTo(bounds.width, 0.5);
      expect(labelBounds.width).to.be.closeTo(labelWidth, 0.5);
      expect(valueBounds.width).to.be.closeTo(valueWidth, 0.5);
      for (const caption of [label, value]) {
        const transform = caption.getScreenCTM()!;
        expect(Math.abs(transform.a)).to.be.closeTo(Math.abs(transform.d), 0.01);
      }
      const [left, right] = direction === 'rtl' ? [valueBounds, labelBounds] : [labelBounds, valueBounds];
      expect(left.left).to.be.closeTo(bounds.left, 1);
      expect(right.right).to.be.closeTo(bounds.right, 1);
      expect(left.right).to.be.below(right.left);
    }
  });
}

it('keeps data paint visible in forced colors', async () => {
  await setForcedColors('active');
  try {
    if (!matchMedia('(forced-colors: active)').matches) return;
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-gauge value="30"></lr-gauge><svg style="forced-color-adjust:none;stroke:Highlight"></svg></div>`);
    const el = wrapper.firstElementChild!;
    const probe = getComputedStyle(wrapper.lastElementChild!);
    const fill = getComputedStyle(el.shadowRoot!.querySelector('[part="fill"]')!);
    expect(fill.stroke).to.equal(probe.stroke);
  } finally {
    await setForcedColors('none');
  }
});
