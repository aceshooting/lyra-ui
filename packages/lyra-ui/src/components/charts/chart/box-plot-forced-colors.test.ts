import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './box-plot.js';
import type { LyraBoxPlot } from './box-plot.js';

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

function boxes(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    label: `Series ${index + 1}`,
    data: [
      { min: index, q1: index + 1, median: index + 2, q3: index + 3, max: index + 4 },
      { min: index + 1, q1: index + 2, median: index + 3, q3: index + 4, max: index + 5 },
    ],
  }));
}

describe('box-plot forced-colors encodings', () => {
  it('textures eight repeated-color series distinctly in the plot and the DOM legend', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = forcedColorsMatchMedia(originalMatchMedia);
    try {
      const el = await fixture<LyraBoxPlot>(html`<lr-box-plot legend></lr-box-plot>`);
      el.labels = ['Q1', 'Q2'];
      el.boxes = boxes(8);
      await el.updateComplete;
      // The DOM legend only renders once the async box-plot peer resolves and the loading skeleton
      // is replaced; `updateComplete` alone still leaves the skeleton up.
      await waitUntil(() => el.shadowRoot!.querySelector('[part="legend"]') != null, 'legend never rendered', {
        timeout: 5000,
      });

      const datasets = (el as never as { buildConfig(): { data: { datasets: Array<Record<string, unknown>> } } })
        .buildConfig()
        .data.datasets;
      expect(datasets).to.have.lengthOf(8);
      expect(datasets.every((dataset) => typeof dataset.backgroundColor === 'object')).to.equal(true);
      expect(new Set(datasets.map((dataset) => dataset.backgroundColor)).size).to.equal(8);

      const swatches = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
      expect(swatches).to.have.lengthOf(8);
      expect(new Set(swatches.map((swatch) => swatch.dataset.encoding)).size).to.equal(8);
      expect(new Set(swatches.map((swatch) => getComputedStyle(swatch).backgroundImage)).size).to.equal(8);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('leaves plain solid series colors and no legend encoding when forced colors are inactive', async () => {
    const el = await fixture<LyraBoxPlot>(html`<lr-box-plot legend></lr-box-plot>`);
    el.labels = ['Q1', 'Q2'];
    el.boxes = boxes(3);
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="legend"]') != null, 'legend never rendered', {
      timeout: 5000,
    });

    const datasets = (el as never as { buildConfig(): { data: { datasets: Array<Record<string, unknown>> } } })
      .buildConfig()
      .data.datasets;
    expect(datasets.every((dataset) => typeof dataset.backgroundColor === 'string')).to.equal(true);
    const swatches = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
    expect(swatches.every((swatch) => swatch.dataset.encoding === undefined)).to.equal(true);
  });
});
