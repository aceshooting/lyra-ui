import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import type { LyraChart } from './chart.js';

function forcedColorsMatchMedia(original: typeof window.matchMedia): typeof window.matchMedia {
  return ((query: string) => {
    if (query !== '(forced-colors: active)') return original(query);
    return {
      matches: true,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    };
  }) as typeof window.matchMedia;
}

describe('chart forced-colors encodings', () => {
  it('gives eight repeated-color series distinct dashes, point shapes, fill patterns, and legend patterns', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = forcedColorsMatchMedia(originalMatchMedia);
    try {
      const el = await fixture<LyraChart>(html`<lr-chart type="line" legend show-data-table></lr-chart>`);
      el.labels = ['Q1', 'Q2'];
      el.datasets = Array.from({ length: 8 }, (_, index) => ({
        label: `Series ${index + 1}`,
        data: [index + 1, index + 2],
        fill: true,
      }));
      await el.updateComplete;
      // The DOM legend and the data table only render once the async Chart.js peer resolves and
      // the loading skeleton is replaced; `updateComplete` alone still leaves the skeleton up.
      await waitUntil(() => (el as any).chart != null, 'chart.js never initialized', {
        timeout: 5000,
      });
      await el.updateComplete;

      const datasets = (el as any).buildConfig().data.datasets as Array<Record<string, unknown>>;
      const signatures = datasets.map((dataset) =>
        JSON.stringify([dataset.borderDash, dataset.pointStyle]),
      );
      expect(new Set(signatures).size).to.equal(8);
      expect(datasets.every((dataset) => typeof dataset.backgroundColor === 'object')).to.be.true;
      expect(new Set(datasets.map((dataset) => dataset.backgroundColor)).size).to.equal(8);

      const swatches = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
      expect(swatches).to.have.lengthOf(8);
      expect(new Set(swatches.map((swatch) => swatch.dataset.encoding)).size).to.equal(8);
      expect(new Set(swatches.map((swatch) => getComputedStyle(swatch).backgroundImage)).size).to.equal(8);

      const headings = [...el.shadowRoot!.querySelectorAll('[part="data-table"] thead th')]
        .map((heading) => heading.textContent?.trim())
        .filter(Boolean);
      expect(headings).to.include.members(['Series 1', 'Series 4', 'Series 7']);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('patterns every slice when system colors repeat in a proportional chart', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = forcedColorsMatchMedia(originalMatchMedia);
    try {
      const el = await fixture<LyraChart>(html`<lr-chart type="pie"></lr-chart>`);
      el.labels = Array.from({ length: 8 }, (_, index) => `Category ${index + 1}`);
      el.datasets = [{ label: 'Share', data: [1, 2, 3, 4, 5, 6, 7, 8] }];
      await el.updateComplete;

      const backgrounds = (el as any).buildConfig().data.datasets[0].backgroundColor as unknown[];
      expect(backgrounds).to.have.lengthOf(8);
      expect(backgrounds.every((background) => typeof background === 'object')).to.be.true;
      expect(new Set(backgrounds).size).to.equal(8);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
