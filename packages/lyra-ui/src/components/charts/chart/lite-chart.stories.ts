import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraLiteChartSeries, LyraLiteChartTableCellFormatter } from '../../../lyra.js';

const meta: Meta = {
  title: 'Charts/LiteChart',
  component: 'lr-lite-chart',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Labels, datasets, nested series data, and selected indices are bounded clone-owned frozen snapshots; create and reassign a new collection after changes.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** Zero-dependency alternative to `lr-chart` — plain SVG/DOM, no `chart.js` peer dep. */
export const Default: Story = {
  render: () => {
    const series: LyraLiteChartSeries[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lr-lite-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        legend
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lr-lite-chart>
    `;
  },
};

/** Narrow-allocation and long-content evidence for the dependency-free chart. */
export const NarrowLongContent: Story = {
  name: 'Narrow (320px) with long content',
  render: () => {
    const series: LyraLiteChartSeries[] = [
      { label: 'Revenue from subscriptions and professional services', data: [12, 19, 14, 22] },
    ];
    return html`
      <div style="inline-size: 320px; max-inline-size: 100%;">
        <lr-lite-chart
          aria-label="Quarterly revenue from subscriptions and professional services"
          type="bar"
          height="16rem"
          legend
          max-labels="4"
          .labels=${['First quarter', 'Second quarter', 'Third quarter', 'Fourth quarter']}
          .datasets=${series}
        ></lr-lite-chart>
      </div>
    `;
  },
};

export const GroupedBars: Story = {
  render: () => {
    const series: LyraLiteChartSeries[] = [
      { label: 'This year', data: [12, 19, 14, 22] },
      { label: 'Last year', data: [9, 15, 11, 18] },
    ];
    return html`
      <lr-lite-chart
        type="bar"
        height="16rem"
        style="width: 24rem"
        legend
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lr-lite-chart>
    `;
  },
};

/** `stacked` sums each category's bars into one segmented bar instead of grouping them side by side. */
export const StackedBars: Story = {
  render: () => {
    const series: LyraLiteChartSeries[] = [
      { label: 'Docs', data: [4, 6, 3, 8] },
      { label: 'Bugs', data: [3, 2, 5, 4] },
      { label: 'Features', data: [5, 7, 6, 3] },
    ];
    return html`
      <lr-lite-chart
        type="bar"
        stacked
        height="16rem"
        style="width: 24rem"
        legend
        x-label="Week"
        y-label="Commits"
        .labels=${['W1', 'W2', 'W3', 'W4']}
        .datasets=${series}
      ></lr-lite-chart>
    `;
  },
};

/** The hidden data table can format independently of axis ticks and opt into stacked totals. */
export const AccessibleTableFormattingAndTotals: Story = {
  name: 'Accessible table formatting and totals',
  render: () => {
    const series: LyraLiteChartSeries[] = [
      { label: 'Product', data: [1204.37, 1890.5, 1420.1] },
      { label: 'Services', data: [804.1, 920.25, 1010.75] },
    ];
    const tableCellFormatter: LyraLiteChartTableCellFormatter = (value, context) =>
      `${context.kind === 'total' ? 'Σ ' : ''}$${value.toFixed(2)}`;
    return html`
      <style>
        .table-demo::part(data-table) {
          position: static;
          inline-size: auto;
          block-size: auto;
          margin-block-start: var(--lr-space-m);
          overflow: visible;
          clip: auto;
          white-space: normal;
        }
      </style>
      <lr-lite-chart
        class="table-demo"
        type="bar"
        stacked
        table-totals
        height="16rem"
        style="width: 28rem; max-width: 100%;"
        .labels=${['Q1', 'Q2', 'Q3']}
        .datasets=${series}
        .tableCellFormatter=${tableCellFormatter}
      ></lr-lite-chart>
    `;
  },
};

/**
 * A slotted data table replaces the bounded generated alternative. Application code can provide a
 * complete, paginated, or virtualized table when the chart's sampled 1,000-record fallback is not
 * sufficient.
 */
export const CustomDataTable: Story = {
  render: () => html`
    <lr-lite-chart
      type="bar"
      height="16rem"
      style="inline-size: 24rem; max-inline-size: 100%;"
      .labels=${['Q1', 'Q2']}
      .datasets=${[{ label: 'Revenue', data: [12, 19] }]}
    >
      <table slot="data-table">
        <caption>Quarterly revenue</caption>
        <thead><tr><th>Quarter</th><th>Revenue</th></tr></thead>
        <tbody><tr><th>Q1</th><td>12</td></tr><tr><th>Q2</th><td>19</td></tr></tbody>
      </table>
    </lr-lite-chart>
  `,
};

export const Line: Story = {
  render: () => {
    const series: LyraLiteChartSeries[] = [
      { label: 'CPU', data: [20, 35, 42, 30, 55] },
      { label: 'Memory', data: [40, 38, 45, 60, 58] },
    ];
    return html`
      <lr-lite-chart
        type="line"
        height="16rem"
        style="width: 24rem"
        legend
        .labels=${['00:00', '00:05', '00:10', '00:15', '00:20']}
        .datasets=${series}
      ></lr-lite-chart>
    `;
  },
};

/** Clicking (or Enter/Space on a focused) bar/point fires `lr-point-click`, same detail shape as `lr-chart`'s. */
export const ClickToFilter: Story = {
  render: () => {
    const series: LyraLiteChartSeries[] = [{ label: 'Runs', data: [12, 19, 14, 22] }];
    return html`
      <lr-lite-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
        @lr-point-click=${(e: CustomEvent) => alert(JSON.stringify(e.detail))}
      ></lr-lite-chart>
    `;
  },
};

/** Controlled selection is exposed visually and as explicit pressed state on every data mark. */
export const SelectedLinePoint: Story = {
  render: () => html`
    <lr-lite-chart
      type="line"
      legend
      legend-position="start"
      height="16rem"
      style="
        width: 22rem;
        --lr-lite-chart-selected-outline-color: var(--lr-color-success);
        --lr-lite-chart-selected-outline-width: var(--lr-border-width-thick);
      "
      .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
      .datasets=${[{ label: 'Runs', data: [12, 19, 14, 22] }]}
      .selectedIndices=${[1]}
    ></lr-lite-chart>
  `,
};

/** `tickFormat` customizes y-axis tick labels (e.g. currency) instead of the built-in nice-number formatter. */
export const CurrencyTickFormat: Story = {
  render: () => {
    const series: LyraLiteChartSeries[] = [{ label: 'Revenue', data: [1204.37, 1890.5, 1420.1, 2260.75] }];
    return html`
      <lr-lite-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
        .tickFormat=${(v: number) => `$${v.toFixed(2)}`}
      ></lr-lite-chart>
    `;
  },
};

/** Automatic axis sizing grows the value gutter for localized currency and thins category labels
 *  from the chart's measured allocation. Both remain opt-in; numeric values still pin either
 *  surface exactly. */
export const AutomaticAxisSizing: Story = {
  name: 'Automatic axis sizing',
  render: () => {
    const labels = Array.from({ length: 18 }, (_, index) =>
      `2026-08-${String(index + 1).padStart(2, '0')}`,
    );
    const currency = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    });
    const series: LyraLiteChartSeries[] = [
      {
        label: 'Umsatz',
        data: labels.map((_, index) => 1200 + ((index * 1379) % 8500)),
      },
    ];
    return html`
      <lr-lite-chart
        type="bar"
        value-axis-gutter="auto"
        max-labels="auto"
        height="16rem"
        style="inline-size: 24rem; max-inline-size: 100%;"
        .labels=${labels}
        .datasets=${series}
        .tickFormat=${(value: number) => currency.format(value)}
      ></lr-lite-chart>
    `;
  },
};

/** `layout="scroll"` gives every bar a fixed `bar-width` instead of squeezing them into the host
 *  width -- with a long category list the plot overflows the (deliberately narrow) host, which
 *  scrolls horizontally to reveal the rest, instead of cramming 40 skinny bars into one view. Its
 *  plot content width is bounded to 1,000,000px even for hostile inputs. */
export const ScrollLayout: Story = {
  render: () => {
    const labels = Array.from({ length: 40 }, (_, i) => `Day ${i + 1}`);
    const series: LyraLiteChartSeries[] = [{ label: 'Signups', data: labels.map((_, i) => 10 + ((i * 7) % 40)) }];
    return html`
      <lr-lite-chart
        type="bar"
        layout="scroll"
        bar-width="28"
        height="16rem"
        style="width: 24rem"
        x-label="Day"
        y-label="Signups"
        .labels=${labels}
        .datasets=${series}
      ></lr-lite-chart>
    `;
  },
};

/**
 * `barX` resolves once per rendered category. Its finite x-origin is shared by the category's bars
 * and label; an invalid return would use normal slot placement instead of leaking invalid SVG
 * geometry.
 */
export const SharedBarXAlignment: Story = {
  render: () => {
    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    return html`
      <lr-lite-chart
        type="bar"
        layout="scroll"
        bar-width="48"
        height="16rem"
        style="inline-size: 24rem; max-inline-size: 100%;"
        .labels=${labels}
        .datasets=${[{ label: 'Deployments', data: [5, 8, 6, 11] }]}
        .barX=${(index: number) => 48 + index * 48}
      ></lr-lite-chart>
    `;
  },
};

/** `maxLabels` thins out which x-axis category labels render text (bars themselves always still
 *  render) once there are more categories than that -- selecting from any bounded record sample,
 *  always keeping its first and last label, and spreading the rest roughly evenly, so a long
 *  category list stays legible in `layout="fit"` instead of the axis text overlapping into an
 *  unreadable smear. */
export const LabelDecimation: Story = {
  render: () => {
    const labels = Array.from({ length: 24 }, (_, i) => `Week ${i + 1}`);
    const series: LyraLiteChartSeries[] = [{ label: 'Throughput', data: labels.map((_, i) => 20 + ((i * 11) % 30)) }];
    return html`
      <lr-lite-chart
        type="bar"
        max-labels="6"
        height="16rem"
        style="width: 26rem"
        x-label="Week"
        y-label="Throughput"
        .labels=${labels}
        .datasets=${series}
      ></lr-lite-chart>
    `;
  },
};

const logarithmicScaleCanarySeries: LyraLiteChartSeries[] = [
  { label: 'End-to-end latency (ms)', data: [1, 10, 100, 1000] },
];

/** Positive decade-spaced values make the logarithmic spacing and the visible table deterministic. */
export const LogarithmicScaleCanary: Story = {
  name: 'Logarithmic scale canary',
  render: () => html`
    <div style="inline-size: 22rem; max-inline-size: 100%;">
      <lr-lite-chart
        aria-label="Logarithmic end-to-end latency"
        type="bar"
        scale="logarithmic"
        height="16rem"
        legend
        show-data-table
        x-label="Scenario"
        y-label="Latency in milliseconds, logarithmic scale"
        .labels=${['1 ms', '10 ms', '100 ms', '1,000 ms']}
        .datasets=${logarithmicScaleCanarySeries}
      ></lr-lite-chart>
      <p>Expected: each bar represents one tenfold latency increase.</p>
    </div>
  `,
};

/** Dense groups keep visible, nonoverlapping bars within the remaining category width. */
export const ManyGroupedSeries: Story = {
  render: () => html`
    <lr-lite-chart
      type="bar" height="16rem" bar-gap-ratio="0.8" show-data-table
      style="inline-size: 32rem; max-inline-size: 100%;"
      .labels=${['Current', 'Previous']}
      .datasets=${Array.from({ length: 12 }, (_, index) => ({ label: `Series ${index + 1}`, data: [index + 1, 12 - index] }))}
    ></lr-lite-chart>
  `,
};

/** Each positive total is mapped onto the log axis once, then divided by raw segment share. */
export const LogarithmicStacks: Story = {
  render: () => html`
    <lr-lite-chart
      type="bar" scale="logarithmic" stacked legend show-data-table height="16rem"
      style="inline-size: 26rem; max-inline-size: 100%;"
      .labels=${['Small total', 'Large total']}
      .datasets=${[{ label: 'First', data: [1, 10] }, { label: 'Second', data: [1, 30] }]}
    ></lr-lite-chart>
  `,
};
