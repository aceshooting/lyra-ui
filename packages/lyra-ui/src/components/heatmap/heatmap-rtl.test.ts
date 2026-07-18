import { fixture, expect, html } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';
import { styles } from './heatmap.styles.js';

it('mirrors the low-to-high legend ramp in RTL', async () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(":host(:dir(rtl)) [part='legend'] .bar { transform: scaleX(-1); }");

  const wrapper = await fixture(html`
    <div dir="rtl">
      <lr-heatmap .values=${[[1, 2]]}></lr-heatmap>
    </div>
  `);
  const el = wrapper.querySelector('lr-heatmap') as LyraHeatmap;
  const bar = el.shadowRoot!.querySelector('[part="legend"] .bar')!;

  expect(getComputedStyle(bar).transform).to.equal('matrix(-1, 0, 0, 1, 0, 0)');
});

it('mirrors a consumer-provided multi-stop palette without rewriting its color order', async () => {
  const wrapper = await fixture(html`
    <div dir="rtl">
      <lr-heatmap
        .values=${[[1, 2]]}
        .colorSteps=${['#010203', '#040506', '#070809']}
      ></lr-heatmap>
    </div>
  `);
  const el = wrapper.querySelector('lr-heatmap') as LyraHeatmap;
  const gradient = el.style.getPropertyValue('--lr-heatmap-color-steps-gradient');
  const bar = el.shadowRoot!.querySelector('[part="legend"] .bar')!;

  expect(gradient).to.include('#010203, #040506, #070809');
  expect(getComputedStyle(bar).transform).to.equal('matrix(-1, 0, 0, 1, 0, 0)');
});
