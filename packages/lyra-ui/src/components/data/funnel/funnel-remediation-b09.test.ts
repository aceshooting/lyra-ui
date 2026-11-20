import { setForcedColors } from '../../../../test/wtr-media.js';
import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-funnel.js';
import type { LyraFunnel } from '../../lr-funnel.js';

it('isolates stage numbers from an RTL host', async () => {
  const el = await fixture<LyraFunnel>(html`<lr-funnel dir="rtl" .stages=${[{ label: 'A', value: -5 }, { label: 'B', value: 3 }]}></lr-funnel>`);
  const value = el.shadowRoot!.querySelector<HTMLElement>('[part="stage-value"]')!;
  expect(getComputedStyle(value).unicodeBidi).to.equal('plaintext');
});

it('keeps small nonzero stage values and shares readable', async () => {
  const el = await fixture<LyraFunnel>(html`<lr-funnel .stages=${[{ label: 'Start', value: 1 }, { label: 'End', value: 0.0004 }]}></lr-funnel>`);
  const stage = el.shadowRoot!.querySelectorAll('[part~="stage"]')[1]!;
  expect(stage.querySelector('[part="stage-value"]')?.textContent).to.equal('0.0004');
  expect(stage.querySelector('[part="stage-share"]')?.textContent?.trim()).to.equal('0.04%');
});

it('keeps data paint visible in forced colors', async () => {
  await setForcedColors('active');
  try {
    if (!matchMedia('(forced-colors: active)').matches) return;
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-funnel .stages=${[{ label: 'Start', value: 10 }, { label: 'End', value: 5 }]}></lr-funnel><div style="forced-color-adjust:none;background:Highlight"></div></div>`);
    const el = wrapper.firstElementChild!;
    const probe = getComputedStyle(wrapper.lastElementChild!);
    const bar = getComputedStyle(el.shadowRoot!.querySelector('[part~="bar"]')!);
    expect(bar.backgroundColor).to.equal(probe.backgroundColor);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="track"]')!).borderTopStyle).to.equal('solid');
  } finally {
    await setForcedColors('none');
  }
});
