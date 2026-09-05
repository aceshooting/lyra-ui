import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './funnel.js';
import type { LyraFunnel } from './funnel.js';

for (const direction of ['ltr', 'rtl']) {
  it(`fills main and comparison tracks for finite division overflow in ${direction}`, async () => {
    const element = await fixture<LyraFunnel>(html`<lr-funnel dir=${direction} style="inline-size: 320px; --lr-transition-base: 0s"
      .stages=${[{ label: 'Base', value: 1e-308 }, { label: 'Overflow', value: 1e308 }]}
      .comparison=${[{ label: 'Base', value: 1e-308 }, { label: 'Overflow', value: 1e308 }]}
    ></lr-funnel>`);
    const track = element.shadowRoot!.querySelectorAll<HTMLElement>('[part="track"]')[1]!;
    await waitUntil(() => track.getBoundingClientRect().width > 0);
    for (const part of ['bar', 'comparison-bar']) {
      const bar = track.querySelector<HTMLElement>(`[part~="${part}"]`)!;
      expect(bar.style.inlineSize).to.equal('100%');
      expect(bar.getBoundingClientRect().width).to.be.closeTo(track.getBoundingClientRect().width, 1);
      expect(getComputedStyle(bar).borderInlineEndWidth).not.to.equal('0px');
      const barRect = bar.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      expect(direction === 'rtl' ? barRect.right : barRect.left).to.be.closeTo(direction === 'rtl' ? trackRect.right : trackRect.left, 1);
    }
    element.stages = [{ label: 'Base', value: 10 }, { label: 'Overflow', value: 20 }, { label: 'Nonfinite', value: Infinity }];
    element.comparison = [{ label: 'Base', value: 10 }, { label: 'Overflow', value: 20 }, { label: 'Nonfinite', value: Infinity }];
    await element.updateComplete;
    expect([...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="bar"]')].map((bar) => bar.style.inlineSize)).to.deep.equal(['100%', '100%', '0%']);
    expect([...element.shadowRoot!.querySelectorAll<HTMLElement>('[part="comparison-bar"]')].map((bar) => bar.style.inlineSize)).to.deep.equal(['100%', '100%', '0%']);
    element.stages = [{ label: 'Base', value: 0 }, { label: 'Value', value: 20 }];
    element.comparison = [{ label: 'Base', value: -1 }, { label: 'Value', value: 20 }];
    await element.updateComplete;
    expect([...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="bar"]')].map((bar) => bar.style.inlineSize)).to.deep.equal(['0%', '0%']);
    expect(element.shadowRoot!.querySelectorAll('[part="comparison-bar"]').length).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[part="stage-share"]').length).to.equal(0);
  });
}
