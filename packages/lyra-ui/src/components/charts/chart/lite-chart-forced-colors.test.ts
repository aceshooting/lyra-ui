import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { forcedColorsMatchMedia } from '../../../../test/chart-forced-colors-media.js';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.js';

/** Waits out the async ResizeObserver pass so the SVG has real geometry before assertions. */
async function mount(template: ReturnType<typeof html>): Promise<LyraLiteChart> {
  const el = (await fixture(template)) as LyraLiteChart;
  await waitUntil(() => {
    const chart = el as unknown as { plotWidth: number; plotHeight: number };
    return !el.ownerDocument.defaultView?.ResizeObserver || (chart.plotWidth > 0 && chart.plotHeight > 0);
  });
  await el.updateComplete;
  return el;
}

const eightSeries = () =>
  Array.from({ length: 8 }, (_, index) => ({
    label: `Series ${index + 1}`,
    data: [index + 1, index + 2],
  }));

describe('lite-chart forced-colors encodings', () => {
  it('re-renders when the live forced-colors query changes and removes its listener on disconnect', async () => {
    const originalMatchMedia = window.matchMedia;
    let active = false;
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    let removals = 0;
    window.matchMedia = ((query: string) => {
      if (query !== '(forced-colors: active)') return originalMatchMedia(query);
      return {
        get matches() { return active; },
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener(_type: string, callback: EventListenerOrEventListenerObject) {
          listener = callback as (event: MediaQueryListEvent) => void;
        },
        removeEventListener() { removals += 1; },
        dispatchEvent: () => false,
      } as MediaQueryList;
    }) as typeof window.matchMedia;
    try {
      const el = await mount(html`<lr-lite-chart
        type="bar"
        .labels=${['A']}
        .datasets=${[{ label: 'S', data: [1] }]}
      ></lr-lite-chart>`);
      expect(el.shadowRoot!.querySelectorAll('pattern')).to.have.length(0);
      active = true;
      listener?.({ matches: true, media: '(forced-colors: active)' } as MediaQueryListEvent);
      await waitUntil(() => el.shadowRoot!.querySelectorAll('pattern').length === 1);
      expect(el.shadowRoot!.querySelectorAll('pattern')).to.have.length(1);
      el.remove();
      expect(removals).to.be.greaterThan(0);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('textures eight repeated-color bar series and their legend swatches distinctly', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = forcedColorsMatchMedia(originalMatchMedia);
    try {
      const el = await mount(
        html`<lr-lite-chart type="bar" with-legend style="inline-size: 640px"></lr-lite-chart>`,
      );
      el.labels = ['Q1', 'Q2'];
      el.datasets = eightSeries();
      await el.updateComplete;

      const patterns = [...el.shadowRoot!.querySelectorAll('pattern')];
      expect(patterns).to.have.lengthOf(8);

      const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
      const fills = bars.map((bar) => bar.getAttribute('fill') ?? '');
      expect(fills.every((fill) => fill.startsWith('url(#'))).to.equal(true);
      expect(new Set(fills).size, 'each series needs its own texture').to.equal(8);

      const swatches = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
      expect(swatches).to.have.lengthOf(8);
      expect(new Set(swatches.map((swatch) => swatch.dataset['encoding'])).size).to.equal(8);
      expect(new Set(swatches.map((swatch) => getComputedStyle(swatch).backgroundImage)).size).to.equal(8);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('dashes eight repeated-color line series distinctly', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = forcedColorsMatchMedia(originalMatchMedia);
    try {
      const el = await mount(
        html`<lr-lite-chart type="line" style="inline-size: 640px"></lr-lite-chart>`,
      );
      el.labels = ['Q1', 'Q2'];
      el.datasets = eightSeries();
      await el.updateComplete;

      const dashes = [...el.shadowRoot!.querySelectorAll('[part="line"]')].map(
        (line) => line.getAttribute('stroke-dasharray') ?? '',
      );
      expect(dashes).to.have.lengthOf(8);
      expect(new Set(dashes).size, 'each series line needs its own dash').to.equal(8);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('keeps the marks intrinsic while axes, gridlines, and legend text stay system-controlled', async function () {
    // The property is a Windows Forced Colors Mode integration point some engines omit entirely;
    // skip rather than fail there, matching src/forced-colors-intrinsic.test.ts.
    if (!CSS.supports('forced-color-adjust', 'none')) this.skip();
    const el = await mount(
      html`<lr-lite-chart type="bar" with-legend y-label="Value" style="inline-size: 640px"></lr-lite-chart>`,
    );
    el.labels = ['Q1', 'Q2'];
    el.datasets = eightSeries();
    await el.updateComplete;

    const computed = (selector: string): string =>
      getComputedStyle(el.shadowRoot!.querySelector(selector)!).forcedColorAdjust;
    expect(computed('[part="bar"]')).to.equal('none');
    expect(computed('[part="grid-line"]')).to.equal('auto');
    expect(computed('[part="axis-label"]')).to.equal('auto');
    expect(computed('[part="legend-item"]')).to.equal('auto');

    el.type = 'line';
    await el.updateComplete;
    expect(computed('[part="line"]')).to.equal('none');
    expect(computed('[part="point"]')).to.equal('none');
  });

  it('leaves solid fills, no patterns, and no legend encoding when forced colors are inactive', async () => {
    const el = await mount(
      html`<lr-lite-chart type="bar" with-legend style="inline-size: 640px"></lr-lite-chart>`,
    );
    el.labels = ['Q1', 'Q2'];
    el.datasets = eightSeries();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('pattern').length).to.equal(0);
    const bars = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
    expect(bars.every((bar) => !(bar.getAttribute('fill') ?? '').startsWith('url('))).to.equal(true);
    const swatches = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
    expect(swatches.every((swatch) => swatch.dataset['encoding'] === undefined)).to.equal(true);
  });
});

it('shares one forced-colors subscription across chart instances', async () => {
  const original = window.matchMedia;
  let subscriptions = 0;
  window.matchMedia = ((query: string) => {
    const media = original.call(window, query);
    if (query === '(forced-colors: active)') {
      const add = media.addEventListener.bind(media);
      media.addEventListener = ((...args: Parameters<typeof media.addEventListener>) => {
        subscriptions++; add(...args);
      }) as typeof media.addEventListener;
    }
    return media;
  }) as typeof window.matchMedia;
  try {
    const host = await fixture<HTMLElement>(html`<div><lr-lite-chart></lr-lite-chart><lr-lite-chart></lr-lite-chart><lr-lite-chart></lr-lite-chart></div>`);
    expect(subscriptions).to.equal(1);
    host.remove();
  } finally { window.matchMedia = original; }
});

it('reads forced-colors media once for a chart render', async () => {
  const el = await mount(html`<lr-lite-chart .labels=${Array.from({length:100},(_,i)=>String(i))}
    .datasets=${[{label:'S',data:Array.from({length:100},()=>1)}]}></lr-lite-chart>`);
  const original = window.matchMedia;
  let reads = 0;
  window.matchMedia = ((query: string) => {
    if (query === '(forced-colors: active)') reads++;
    return original.call(window, query);
  }) as typeof window.matchMedia;
  try { el.requestUpdate(); await el.updateComplete; }
  finally { window.matchMedia = original; }
  expect(reads).to.be.at.most(1);
});
