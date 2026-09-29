import { expectDeprecatedUsage } from '../../../../test/expected-deprecations.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import './line-chart.js';
import './box-plot.js';
import './lite-chart.js';
import type { LyraChart } from './chart.js';
import type { LyraBoxPlot } from './box-plot.js';
import type { LyraLiteChart } from './lite-chart.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

// Every deprecated chart-family alias keeps working with the same observable result as its
// canonical name, warns once in development, stays in step with its canonical partner in both
// directions, and follows the last write when both spellings are authored.

const property = (tag: string, name: string): DeprecatedUsage => ({ tag, kind: 'property', name });

function keyOf(usage: DeprecatedUsage): string {
  return `lyra-deprecated:${usage.tag}:${usage.kind}:${usage.name}`;
}

function tableHidden(el: HTMLElement): boolean {
  return el.shadowRoot!.querySelector('[part~="data-table"]')!.hasAttribute('data-visually-hidden');
}

const LINE = { labels: ['Q1', 'Q2', 'Q3'], datasets: [{ label: 'Revenue', data: [90, 95, 100] }] };

async function chartWith(markup: unknown): Promise<LyraChart> {
  const el = (await fixture(markup as never)) as LyraChart;
  el.labels = LINE.labels;
  el.datasets = LINE.datasets;
  await el.updateComplete;
  // The generated table renders once the lazily loaded Chart.js peer replaces the skeleton.
  await waitUntil(() => el.shadowRoot!.querySelector('[part~="data-table"]') !== null);
  return el;
}

type ChartConfig = {
  options: {
    layout?: unknown;
    scales: Record<string, { beginAtZero?: boolean; display?: boolean } | undefined>;
    plugins: { zoom?: unknown; tooltip: { bodyColor: string } };
  };
};

function configOf(el: HTMLElement): ChartConfig {
  return (el as unknown as { buildConfig(): ChartConfig }).buildConfig();
}

describe('lr-chart: deprecated aliases', () => {
  it('shows the data table through with-data-table without any warning', async () => {
    let el!: LyraChart;
    const warnings = await captureDeprecationWarnings([], async () => {
      el = await chartWith(html`<lr-chart with-data-table></lr-chart>`);
    });
    expect(warnings).to.have.length(0);
    expect(tableHidden(el)).to.equal(false);
    expect(el.showDataTable, 'the alias reads the canonical state').to.equal(true);
  });

  it('keeps show-data-table working, warning once and naming with-data-table', async () => {
    const usage = property('lr-chart', 'showDataTable');
    let el!: LyraChart;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      el = await chartWith(html`<lr-chart show-data-table></lr-chart>`);
      el.showDataTable = false;
      el.showDataTable = true;
      await el.updateComplete;
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(warnings[0]!.message).to.contain('with-data-table');
    expect(el.withDataTable).to.equal(true);
    expect(tableHidden(el)).to.equal(false);

    await captureDeprecationWarnings([usage], async () => {
      el.removeAttribute('show-data-table');
      await el.updateComplete;
    });
    expect(el.withDataTable, 'removing the alias restores the default').to.equal(false);
    expect(tableHidden(el)).to.equal(true);
  });

  it('warns with the subclass tag and behaves identically on a typed chart', async () => {
    const usage = property('lr-line-chart', 'showDataTable');
    let el!: LyraChart;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      el = await chartWith(html`<lr-line-chart show-data-table></lr-line-chart>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(tableHidden(el)).to.equal(false);
  });

  it('treats begin-at-zero="false" exactly like without-zero-baseline', async () => {
    const usage = property('lr-chart', 'beginAtZero');
    const canonical = await chartWith(html`<lr-chart type="line" without-zero-baseline></lr-chart>`);
    let alias!: LyraChart;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      alias = await chartWith(html`<lr-chart type="line" begin-at-zero="false"></lr-chart>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(warnings[0]!.message).to.contain('without-zero-baseline');
    expect(alias.withoutZeroBaseline).to.equal(true);
    expect(alias.beginAtZero).to.equal(false);
    expect(configOf(alias).options.scales['y']!.beginAtZero).to.equal(false);
    expect(configOf(canonical).options.scales['y']!.beginAtZero).to.equal(false);

    await captureDeprecationWarnings([usage], async () => {
      alias.removeAttribute('begin-at-zero');
      await alias.updateComplete;
    });
    expect(alias.withoutZeroBaseline, 'removing the alias restores the zero baseline').to.equal(false);
    expect(configOf(alias).options.scales['y']!.beginAtZero).to.equal(true);
  });

  it('follows the last write between without-zero-baseline and begin-at-zero', async () => {
    const usage = property('lr-chart', 'beginAtZero');
    let aliasLast!: LyraChart;
    let canonicalLast!: LyraChart;
    await captureDeprecationWarnings([usage], async () => {
      aliasLast = await chartWith(html`<lr-chart without-zero-baseline begin-at-zero></lr-chart>`);
      canonicalLast = await chartWith(html`<lr-chart begin-at-zero="false" without-zero-baseline></lr-chart>`);
    });
    expect(aliasLast.withoutZeroBaseline).to.equal(false);
    expect(canonicalLast.withoutZeroBaseline).to.equal(true);
    expect(canonicalLast.beginAtZero).to.equal(false);
  });

  it('syncs every alias back from its canonical property without warning', async () => {
    const usages = ['showDataTable', 'beginAtZero', 'zoom', 'compact'].map((name) => property('lr-chart', name));
    let reads: unknown[] = [];
    const warnings = await captureDeprecationWarnings(usages, async () => {
      const el = await chartWith(html`<lr-chart></lr-chart>`);
      el.withDataTable = true;
      el.withoutZeroBaseline = true;
      el.zoomable = true;
      el.size = 's';
      await el.updateComplete;
      reads = [el.showDataTable, el.beginAtZero, el.zoom, el.compact];
    });
    expect(warnings).to.have.length(0);
    expect(reads).to.deep.equal([true, false, true, true]);
  });

  it('keeps zoom working as an alias of zoomable', async () => {
    const usage = property('lr-chart', 'zoom');
    let el!: LyraChart;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      el = await chartWith(html`<lr-chart type="line" zoom></lr-chart>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(warnings[0]!.message).to.contain('zoomable');
    expect(el.zoomable).to.equal(true);
    expect(el.zoom).to.equal(true);
    expect(configOf(el).options.plugins.zoom !== undefined, 'the zoom plugin is configured').to.equal(true);
  });

  it('maps compact onto the s size tier, and size="s" renders the same compact plot', async () => {
    const usage = property('lr-chart', 'compact');
    const sized = await chartWith(html`<lr-chart size="s"></lr-chart>`);
    let alias!: LyraChart;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      alias = await chartWith(html`<lr-chart compact></lr-chart>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(warnings[0]!.message).to.contain('size');
    expect(alias.size).to.equal('s');
    expect(alias.compact).to.equal(true);
    expect(sized.compact, 'the alias reads the canonical tier').to.equal(true);
    for (const el of [sized, alias]) {
      const { options } = configOf(el);
      expect(options.layout).to.deep.equal({ padding: 0, autoPadding: false });
      expect(options.scales['x']!.display).to.equal(false);
    }

    await captureDeprecationWarnings([usage], async () => {
      alias.compact = false;
      await alias.updateComplete;
    });
    expect(alias.size).to.equal('m');
    expect(configOf(alias).options.layout).to.equal(undefined);
    expect(configOf(alias).options.scales['x']!.display).to.equal(true);
  });

  it('follows the last write between size and compact, and reads smaller tiers as compact', async () => {
    const usage = property('lr-chart', 'compact');
    let compactLast!: LyraChart;
    let sizeLast!: LyraChart;
    await captureDeprecationWarnings([usage], async () => {
      compactLast = await chartWith(html`<lr-chart size="l" compact></lr-chart>`);
      sizeLast = await chartWith(html`<lr-chart compact size="l"></lr-chart>`);
    });
    expect(compactLast.size).to.equal('s');
    expect(sizeLast.size).to.equal('l');
    expect(sizeLast.compact).to.equal(false);
    sizeLast.size = 'xs';
    expect(sizeLast.compact).to.equal(true);
  });

  it('themes the tooltip through --lr-chart-tooltip-color, keeping --lr-chart-tooltip-text as an alias', async () => {
    const el = await chartWith(html`<lr-chart type="line"></lr-chart>`);
    await waitUntil(() => (el as unknown as { chart?: unknown }).chart != null);
    el.style.setProperty('--lr-chart-tooltip-text', 'rgb(13, 14, 15)');
    expect(configOf(el).options.plugins.tooltip.bodyColor).to.equal('rgb(13, 14, 15)');
    el.style.setProperty('--lr-chart-tooltip-color', 'rgb(1, 2, 3)');
    expect(configOf(el).options.plugins.tooltip.bodyColor, 'the canonical name wins').to.equal(
      'rgb(1, 2, 3)',
    );
  });

  it('fires lr-point-activate, then the lr-point-click alias with an equal detail and no warning', async () => {
    const el = document.createElement('lr-chart') as LyraChart;
    const order: string[] = [];
    const details = new Map<string, unknown>();
    for (const name of ['lr-datum-activate', 'lr-point-activate', 'lr-point-click']) {
      el.addEventListener(name, (event) => {
        order.push(name);
        details.set(name, (event as CustomEvent).detail);
      });
    }
    const warnings = await captureDeprecationWarnings([], () => {
      (el as unknown as { activateDatum(value: unknown): void }).activateDatum({
        datasetIndex: 0,
        index: 1,
        label: 'B',
        value: 2,
      });
    });
    expect(warnings).to.have.length(0);
    expect(order).to.deep.equal(['lr-datum-activate', 'lr-point-activate', 'lr-point-click']);
    const detail = { datasetIndex: 0, index: 1, label: 'B', value: 2 };
    expect(details.get('lr-point-activate')).to.deep.equal(detail);
    expect(details.get('lr-point-click')).to.deep.equal(detail);
    expect(
      details.get('lr-point-activate') === details.get('lr-point-click'),
      'each event carries its own copy',
    ).to.equal(false);
  });
});

const BOXES = [
  {
    label: 'Latency',
    data: [
      { min: 10, q1: 12, median: 14, q3: 16, max: 18 },
      { min: 11, q1: 13, median: 15, q3: 17, max: 19 },
    ],
  },
];

async function boxPlotWith(markup: unknown): Promise<LyraBoxPlot> {
  const el = (await fixture(markup as never)) as LyraBoxPlot;
  el.labels = ['A', 'B'];
  el.datasets = BOXES;
  await el.updateComplete;
  return el;
}

function hasLegend(el: HTMLElement): boolean {
  return el.shadowRoot!.querySelector('[part="legend"]') !== null;
}

describe('lr-box-plot: deprecated aliases', () => {
  it('syncs every alias back from its canonical property without warning, and follows the last write', async () => {
    const usages = ['legend', 'beginAtZero', 'showDataTable'].map((name) => property('lr-box-plot', name));
    let reads: unknown[] = [];
    const warnings = await captureDeprecationWarnings(usages, async () => {
      const el = await boxPlotWith(html`<lr-box-plot></lr-box-plot>`);
      el.withLegend = true;
      el.withoutZeroBaseline = true;
      el.withDataTable = true;
      await el.updateComplete;
      reads = [el.legend, el.beginAtZero, el.showDataTable];
    });
    expect(warnings).to.have.length(0);
    expect(reads).to.deep.equal([true, false, true]);

    let lastWrite: unknown[] = [];
    await captureDeprecationWarnings(usages, async () => {
      const el = await boxPlotWith(html`<lr-box-plot with-legend legend="" without-zero-baseline></lr-box-plot>`);
      el.legend = false;
      el.beginAtZero = true;
      await el.updateComplete;
      lastWrite = [el.withLegend, el.withoutZeroBaseline];
    });
    expect(lastWrite).to.deep.equal([false, false]);
  });

  it('renders the legend through with-legend and through the legend alias', async () => {
    const usage = property('lr-box-plot', 'legend');
    const canonical = await boxPlotWith(html`<lr-box-plot with-legend></lr-box-plot>`);
    let alias!: LyraBoxPlot;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      alias = await boxPlotWith(html`<lr-box-plot legend></lr-box-plot>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(warnings[0]!.message).to.contain('with-legend');
    expect(alias.withLegend).to.equal(true);
    await waitUntil(() => hasLegend(canonical) && hasLegend(alias), 'both legends render');

    await captureDeprecationWarnings([usage], async () => {
      alias.removeAttribute('legend');
      await alias.updateComplete;
    });
    expect(hasLegend(alias)).to.equal(false);
  });

  it('treats begin-at-zero="false" exactly like without-zero-baseline', async () => {
    const usage = property('lr-box-plot', 'beginAtZero');
    const canonical = await boxPlotWith(html`<lr-box-plot without-zero-baseline></lr-box-plot>`);
    let alias!: LyraBoxPlot;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      alias = await boxPlotWith(html`<lr-box-plot begin-at-zero="false"></lr-box-plot>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(alias.withoutZeroBaseline).to.equal(true);
    expect(alias.beginAtZero).to.equal(false);
    await waitUntil(() => (canonical as unknown as { chart?: unknown }).chart != null);
    await waitUntil(() => (alias as unknown as { chart?: unknown }).chart != null);
    expect(configOf(alias).options.scales['y']!.beginAtZero).to.equal(false);
    expect(configOf(canonical).options.scales['y']!.beginAtZero).to.equal(false);
  });

  it('keeps show-data-table working as an alias of with-data-table', async () => {
    const usage = property('lr-box-plot', 'showDataTable');
    const canonical = await boxPlotWith(html`<lr-box-plot with-data-table></lr-box-plot>`);
    let alias!: LyraBoxPlot;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      alias = await boxPlotWith(html`<lr-box-plot show-data-table></lr-box-plot>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(tableHidden(canonical)).to.equal(false);
    expect(tableHidden(alias)).to.equal(false);
    expect(alias.withDataTable).to.equal(true);
  });

  it('themes the canvas tooltip text through --lr-chart-tooltip-color, keeping the -text alias', async () => {
    const el = await boxPlotWith(html`<lr-box-plot></lr-box-plot>`);
    await waitUntil(() => (el as unknown as { chart?: unknown }).chart != null);
    el.style.setProperty('--lr-chart-tooltip-text', 'rgb(13, 14, 15)');
    expect(configOf(el).options.plugins.tooltip.bodyColor).to.equal('rgb(13, 14, 15)');
    el.style.setProperty('--lr-chart-tooltip-color', 'rgb(1, 2, 3)');
    expect(configOf(el).options.plugins.tooltip.bodyColor, 'the canonical name wins').to.equal(
      'rgb(1, 2, 3)',
    );
  });

  it('fires lr-point-activate, then the lr-point-click alias with an equal detail', async () => {
    const el = document.createElement('lr-box-plot') as LyraBoxPlot;
    const order: string[] = [];
    const details = new Map<string, unknown>();
    for (const name of ['lr-datum-activate', 'lr-point-activate', 'lr-point-click']) {
      el.addEventListener(name, (event) => {
        order.push(name);
        details.set(name, (event as CustomEvent).detail);
      });
    }
    const summary = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
    const warnings = await captureDeprecationWarnings([], () => {
      (el as unknown as { activateBox(value: unknown): void }).activateBox({
        datasetIndex: 0,
        index: 0,
        label: 'A',
        value: summary,
      });
    });
    expect(warnings).to.have.length(0);
    expect(order).to.deep.equal(['lr-datum-activate', 'lr-point-activate', 'lr-point-click']);
    const detail = { datasetIndex: 0, index: 0, label: 'A', value: summary };
    expect(details.get('lr-point-activate')).to.deep.equal(detail);
    expect(details.get('lr-point-click')).to.deep.equal(detail);
  });
});

async function liteChartWith(markup: unknown): Promise<LyraLiteChart> {
  const el = (await fixture(markup as never)) as LyraLiteChart;
  el.labels = ['A', 'B'];
  el.datasets = [
    { label: 'Revenue', data: [90, 100] },
    { label: 'Cost', data: [92, 98] },
  ];
  // Geometry renders once the ResizeObserver has measured the plot.
  await waitUntil(() => {
    const chart = el as unknown as { plotWidth: number; plotHeight: number };
    return chart.plotWidth > 0 && chart.plotHeight > 0;
  });
  await el.updateComplete;
  return el;
}

function valueTicks(el: LyraLiteChart): string[] {
  return [...el.shadowRoot!.querySelectorAll('[part="axis-label"]')]
    .map((label) => label.textContent ?? '')
    .filter((text) => /^-?\d+(\.\d+)?$/.test(text));
}

function svgName(el: LyraLiteChart): string | null {
  return el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label');
}

describe('lr-lite-chart: deprecated aliases', () => {
  it('syncs every alias back from its canonical property without warning, and follows the last write', async () => {
    const usages = ['legend', 'beginAtZero', 'showDataTable'].map((name) => property('lr-lite-chart', name));
    let reads: unknown[] = [];
    const warnings = await captureDeprecationWarnings(usages, async () => {
      const el = await liteChartWith(html`<lr-lite-chart></lr-lite-chart>`);
      el.withLegend = true;
      el.withoutZeroBaseline = true;
      el.withDataTable = true;
      await el.updateComplete;
      reads = [el.legend, el.beginAtZero, el.showDataTable];
    });
    expect(warnings).to.have.length(0);
    expect(reads).to.deep.equal([true, false, true]);

    let lastWrite: unknown[] = [];
    await captureDeprecationWarnings(usages, async () => {
      const el = await liteChartWith(html`<lr-lite-chart with-legend legend="" without-zero-baseline></lr-lite-chart>`);
      el.legend = false;
      el.beginAtZero = true;
      await el.updateComplete;
      lastWrite = [el.withLegend, el.withoutZeroBaseline];
    });
    expect(lastWrite).to.deep.equal([false, false]);
  });

  it('renders the legend through with-legend and through the legend alias', async () => {
    const usage = property('lr-lite-chart', 'legend');
    const canonical = await liteChartWith(html`<lr-lite-chart with-legend></lr-lite-chart>`);
    let alias!: LyraLiteChart;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      alias = await liteChartWith(html`<lr-lite-chart legend></lr-lite-chart>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(hasLegend(canonical)).to.equal(true);
    expect(hasLegend(alias)).to.equal(true);
    expect(alias.withLegend).to.equal(true);
  });

  it('treats begin-at-zero="false" exactly like without-zero-baseline', async () => {
    const usage = property('lr-lite-chart', 'beginAtZero');
    const baseline = await liteChartWith(html`<lr-lite-chart></lr-lite-chart>`);
    const canonical = await liteChartWith(html`<lr-lite-chart without-zero-baseline></lr-lite-chart>`);
    let alias!: LyraLiteChart;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      alias = await liteChartWith(html`<lr-lite-chart begin-at-zero="false"></lr-lite-chart>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(alias.withoutZeroBaseline).to.equal(true);
    expect(valueTicks(baseline)).to.include('0');
    expect(valueTicks(canonical)).to.not.include('0');
    expect(valueTicks(alias)).to.deep.equal(valueTicks(canonical));
  });

  it('keeps show-data-table working as an alias of with-data-table', async () => {
    const usage = property('lr-lite-chart', 'showDataTable');
    let el!: LyraLiteChart;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      el = await liteChartWith(html`<lr-lite-chart show-data-table></lr-lite-chart>`);
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(tableHidden(el)).to.equal(false);
    expect(el.withDataTable).to.equal(true);
  });

  it('names the chart through the host aria-label, re-rendering when it changes', async () => {
    const el = await liteChartWith(html`<lr-lite-chart aria-label="Quarterly revenue"></lr-lite-chart>`);
    expect(svgName(el)).to.equal('Quarterly revenue');
    el.setAttribute('aria-label', 'Quarterly cost');
    await el.updateComplete;
    expect(svgName(el)).to.equal('Quarterly cost');
  });

  it('keeps the accessible-label attribute naming the chart, warning once and naming aria-label', async () => {
    const usage: DeprecatedUsage = { tag: 'lr-lite-chart', kind: 'attribute', name: 'accessible-label' };
    let el!: LyraLiteChart;
    const warnings = await captureDeprecationWarnings([usage], async () => {
      el = await liteChartWith(html`<lr-lite-chart accessible-label="Legacy name"></lr-lite-chart>`);
      el.setAttribute('accessible-label', 'Renamed legacy name');
      await el.updateComplete;
    });
    expect(warnings.map((warning) => warning.key)).to.deep.equal([keyOf(usage)]);
    expect(warnings[0]!.message).to.contain('aria-label');
    expect(el.accessibleLabel).to.equal('Renamed legacy name');
    expect(svgName(el)).to.equal('Renamed legacy name');

    await captureDeprecationWarnings([usage], async () => {
      el.removeAttribute('accessible-label');
      await el.updateComplete;
    });
    expect(svgName(el), 'removing the alias restores the derived name').to.equal('Revenue and Cost');
  });

  it('lets the host aria-label win over the accessible-label alias', async () => {
    const usage: DeprecatedUsage = { tag: 'lr-lite-chart', kind: 'attribute', name: 'accessible-label' };
    let el!: LyraLiteChart;
    await captureDeprecationWarnings([usage], async () => {
      el = await liteChartWith(
        html`<lr-lite-chart aria-label="New" accessible-label="Old"></lr-lite-chart>`,
      );
    });
    expect(svgName(el)).to.equal('New');
  });

  it('fires lr-point-activate, then the lr-point-click alias with an equal detail', async () => {
    const el = await liteChartWith(html`<lr-lite-chart></lr-lite-chart>`);
    const order: string[] = [];
    const details = new Map<string, unknown>();
    for (const name of ['lr-datum-activate', 'lr-point-activate', 'lr-point-click']) {
      el.addEventListener(name, (event) => {
        order.push(name);
        details.set(name, (event as CustomEvent).detail);
      });
    }
    const warnings = await captureDeprecationWarnings([], () => {
      el.shadowRoot!.querySelector('[part="bar"]')!.dispatchEvent(
        new MouseEvent('click', { bubbles: true, composed: true }),
      );
    });
    expect(warnings).to.have.length(0);
    expect(order).to.deep.equal(['lr-datum-activate', 'lr-point-activate', 'lr-point-click']);
    expect(details.get('lr-point-click')).to.deep.equal(details.get('lr-point-activate'));
    expect((details.get('lr-point-activate') as { datasetIndex: number }).datasetIndex).to.equal(0);
  });
});

expectDeprecatedUsage('lr-lite-chart', 'property', 'accessibleLabel');
