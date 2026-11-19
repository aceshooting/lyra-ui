import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './line-chart.js';
import './bubble-chart.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './lite-chart.js';
import './box-plot.js';
import '../../data/sparkline/sparkline.js';
import type { LyraChart } from './chart.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import type { LyraBoxPlot } from './box-plot.class.js';
import type { LyraSparkline } from '../../data/sparkline/sparkline.class.js';
import { chartValueFractionDigits, formatChartValue } from '../../../internal/chart-number-format.js';

const tableText = (el: Element): string =>
  el.shadowRoot!.querySelector('table')?.textContent?.replace(/\s+/g, ' ') ?? '';

describe('chart default value formatting', () => {
  it('keeps three significant digits below one and the locale default otherwise', () => {
    expect(formatChartValue(0.0004, 'en')).to.equal('0.0004');
    expect(formatChartValue(0.000123456, 'en')).to.equal('0.000123');
    expect(formatChartValue(-0.0007, 'en')).to.equal('-0.0007');
    expect(formatChartValue(0.25, 'en')).to.equal('0.25');
    expect(formatChartValue(1234.5678, 'en')).to.equal('1,234.568');
    expect(formatChartValue(0, 'en')).to.equal('0');
    expect(chartValueFractionDigits(5)).to.equal(3);
  });

  it('lr-chart tables and announces small values instead of "0"', async () => {
    const el = await fixture<LyraChart>(html`<lr-line-chart without-animation with-data-table
      .labels=${['a', 'b']} .datasets=${[{ label: 'p', data: [0.0004, 0.0007] }]}></lr-line-chart>`);
    await waitUntil(() => tableText(el).includes('0.0004'), 'table value', { timeout: 5000 });
    expect(tableText(el)).to.contain('0.0007');
  });

  it('uses localized scientific notation before the decimal digit cap erases a finite value', () => {
    const scientific = new Intl.NumberFormat('fr', { notation: 'scientific', maximumSignificantDigits: 3 });
    for (const value of [1.25e-30, -2.5e-30, Number.MIN_VALUE]) {
      expect(formatChartValue(value, 'fr')).to.equal(scientific.format(value));
    }
    expect(formatChartValue(0, 'fr')).to.equal('0');
  });

  it('keeps tiny bubble coordinates distinct in its table and keyboard announcement', async () => {
    const el = await fixture<LyraChart>(html`<lr-bubble-chart lang="en" without-animation with-data-table
      .datasets=${[{ label: 'p', points: [{ x: 1e-30, y: 0, r: 3 }, { x: 2e-30, y: -3e-30, r: 4 }] }]}
    ></lr-bubble-chart>`);
    await waitUntil(() => !!el.chart, 'bubble chart initialized', { timeout: 5000 });
    expect(tableText(el)).to.contain('1E-30');
    expect(tableText(el)).to.contain('2E-30');
    expect(tableText(el)).to.contain('-3E-30');
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    await focusByKeyboard(canvas);
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await waitUntil(() => document.querySelector('[data-lr-live-region="polite"]')?.textContent?.includes('2E-30') === true);
  });

  it('lr-lite-chart tables and titles small values instead of "0"', async () => {
    const el = await fixture<LyraLiteChart>(html`<lr-lite-chart with-data-table
      .labels=${['a', 'b']} .datasets=${[{ label: 'p', data: [0.0004, 0.0007] }, { label: 'q', data: [1, 2] }]}>
      </lr-lite-chart>`);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="bar"]').length > 0, 'bars');
    expect(tableText(el)).to.contain('0.0004');
    const names = Array.from(el.shadowRoot!.querySelectorAll('[part="bar"]'))
      .map((bar) => bar.getAttribute('aria-label') ?? '');
    expect(names.some((name) => name.includes('0.0007'))).to.equal(true);
  });

  it('lr-box-plot tables small statistics instead of "0"', async () => {
    const box = { min: 0.0001, q1: 0.0002, median: 0.0004, q3: 0.0006, max: 0.0009 };
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot with-data-table .labels=${['a']}
      .datasets=${[{ label: 'p', data: [box] }]}></lr-box-plot>`);
    await waitUntil(() => tableText(el).includes('0.0004'), 'table median');
  });

  it('lr-sparkline names a small last value instead of "0"', async () => {
    const el = await fixture<LyraSparkline>(html`<lr-sparkline .values=${[0.001, 0.004]}></lr-sparkline>`);
    await el.updateComplete;
    const name = el.shadowRoot!.querySelector('svg')?.getAttribute('aria-label') ?? '';
    expect(name).to.contain('0.004');
  });
});
