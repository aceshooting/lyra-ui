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

it('keeps small drop-offs, shares and values from reading as zero', async () => {
  const element = await fixture<LyraFunnel>(html`<lr-funnel .stages=${[{ label: 'Visits', value: 1000 }, { label: 'Signups', value: 996 }, { label: 'Tiny', value: 0.0004 }]}></lr-funnel>`);
  const text = (part: string) => [...element.shadowRoot!.querySelectorAll(`[part="${part}"]`)].map((node) => node.textContent!.trim());
  expect(text('dropoff')[0]).to.include('0.4%');
  expect(text('stage-value')[2]).to.equal('0.0004');
  expect(text('stage-share')[2]).to.not.equal('0%');
});

it('draws the comparison outline and overflow cap from the border-width ladder', async () => {
  const element = await fixture<LyraFunnel>(html`<lr-funnel style="--lr-theme-border-width-thin: 2px; --lr-theme-border-width-thick: 5px"
    .stages=${[{ label: 'A', value: 10 }, { label: 'B', value: 20 }]} .comparison=${[{ label: 'A', value: 10 }, { label: 'B', value: 5 }]}></lr-funnel>`);
  const outline = getComputedStyle(element.shadowRoot!.querySelector('[part="comparison-bar"]')!).borderTopWidth;
  const cap = getComputedStyle(element.shadowRoot!.querySelector('[part~="bar-overflow"]')!).borderInlineEndWidth;
  expect([outline, cap]).to.deep.equal(['2px', '5px']);
});
