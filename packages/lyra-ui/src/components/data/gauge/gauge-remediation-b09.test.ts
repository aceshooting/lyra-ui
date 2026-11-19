import { setForcedColors } from '../../../../test/wtr-media.js';
import { expect, fixture, html } from '@open-wc/testing';
import './gauge.js';
import type { LyraGauge } from './gauge.js';

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

it('keeps linear captions uniformly scaled when the host narrows', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="inline-size: 110px">
    <lr-gauge shape="linear" value="30" label="CPU"></lr-gauge>
  </div>`);
  const gauge = wrapper.querySelector('lr-gauge')!;
  const caption = gauge.shadowRoot!.querySelector<SVGTextElement>('[part="value"]')!;
  const transform = caption.getScreenCTM()!;
  expect(Math.abs(transform.a)).to.be.closeTo(Math.abs(transform.d), 0.01);
});

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
