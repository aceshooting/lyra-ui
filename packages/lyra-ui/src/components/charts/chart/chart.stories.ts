import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { seriesPalette, type Series } from './chart.js';

const meta: Meta = {
  title: 'Charts/Chart',
  component: 'lr-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lr-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        legend
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lr-chart>
    `;
  },
};

export const PreMountSeriesPalette: Story = {
  name: 'Pre-mount series palette',
  parameters: {
    docs: {
      description: {
        story:
          '`seriesPalette(scope?)` resolves the theme ramp before a chart element exists, so application code can build its Series array and chart-adjacent UI from the same colors.',
      },
    },
  },
  render: () => {
    const palette = seriesPalette(document.documentElement);
    const series: Series[] = [
      { label: 'Revenue', data: [12, 19, 14, 22], color: palette[0] },
      { label: 'Costs', data: [7, 11, 9, 13], color: palette[1] },
    ];
    return html`
      <lr-chart
        type="line"
        legend
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lr-chart>
    `;
  },
};

export const DoughnutCenterAndAutoLegend: Story = {
  name: 'Doughnut center overlay with auto legend',
  render: () => html`
    <lr-doughnut-chart
      type="doughnut"
      height="18rem"
      style="inline-size: 24rem; max-inline-size: 100%;"
      legend
      legend-position="auto"
      .labels=${['Completed', 'Remaining']}
      .datasets=${[{ label: 'Work', data: [72, 28], color: ['var(--lr-color-success)', 'var(--lr-color-border)'] }]}
    >
      <strong slot="center">72%</strong>
    </lr-doughnut-chart>
  `,
};

export const FormattedValues: Story = {
  render: () => html`
    <lr-chart
      type="bar"
      legend
      valueFormatter=${(value: number, context: string) =>
        context === 'tooltip' ? `$${value.toFixed(2)}` : value.toLocaleString()}
      .labels=${['Q1', 'Q2', 'Q3']}
      .datasets=${[{ label: 'Revenue', data: [1200, 1900, 1400] }]}
    ></lr-chart>
  `,
};

/** Narrow-allocation and long-content evidence for charts embedded in panels and dialogs. */
export const NarrowLongContent: Story = {
  name: 'Narrow (320px) with long content',
  render: () => {
    const series: Series[] = [
      { label: 'Revenue from subscriptions and professional services', data: [12, 19, 14, 22] },
    ];
    return html`
      <div style="inline-size: 320px; max-inline-size: 100%;">
        <lr-chart
          aria-label="Quarterly revenue from subscriptions and professional services"
          type="bar"
          height="16rem"
          legend
          .labels=${['First quarter', 'Second quarter', 'Third quarter', 'Fourth quarter']}
          .datasets=${series}
        ></lr-chart>
      </div>
    `;
  },
};

/**
 * The `config` property is the raw Chart.js passthrough escape hatch — it is
 * deep-merged over the `Series`-generated config, so a nested key like
 * `options.plugins.title` can be set without discarding the rest of the
 * generated config the `type`/`labels`/`datasets` attributes produce.
 */
export const ConfigPassthrough: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lr-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
        .config=${{
          options: { plugins: { title: { display: true, text: 'Quarterly revenue' } } },
        }}
      ></lr-chart>
    `;
  },
};

/** `horizontal` sets Chart.js's `indexAxis: 'y'`, flipping bars onto a horizontal axis. */
export const Horizontal: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lr-chart
        type="bar"
        horizontal
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lr-chart>
    `;
  },
};

/** `stacked` stacks every dataset sharing an axis on top of each other instead of side by side. */
export const Stacked: Story = {
  render: () => {
    const series: Series[] = [
      { label: 'Product A', data: [12, 19, 14, 22] },
      { label: 'Product B', data: [8, 11, 9, 15] },
    ];
    return html`
      <lr-chart
        type="bar"
        stacked
        legend
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lr-chart>
    `;
  },
};

/**
 * The `--lr-chart-grid-color`/`-tick-color`/`-legend-color`/`-tooltip-bg`/
 * `-tooltip-text` custom properties retheme Chart.js's canvas-drawn chrome
 * (grid lines, axis ticks/titles, legend labels, tooltip). Chart.js can't
 * consume `var()` directly, so these are resolved via `getComputedStyle`
 * once per draw — see `themeColors()` in `chart.ts`.
 */
export const ThemedTokens: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lr-chart
        type="bar"
        legend
        height="16rem"
        style="
          width: 22rem;
          --lr-chart-grid-color: var(--lr-color-danger);
          --lr-chart-tick-color: var(--lr-color-danger);
          --lr-chart-legend-color: var(--lr-color-danger);
          --lr-chart-tooltip-bg: var(--lr-color-text);
          --lr-chart-tooltip-text: var(--lr-color-surface);
        "
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lr-chart>
    `;
  },
};

/**
 * `lr-point-click` fires whenever a click lands on (or nearest,
 * intersect-only) a data point/segment. The focused canvas exposes the same
 * points through Arrow/Home/End navigation and Enter/Space activation.
 * `refreshTheme()` forces a redraw so an out-of-band theme change (e.g. a
 * host-level dark-mode toggle that doesn't touch any `lr-chart` property)
 * is picked up immediately, rather than waiting for the next reactive update.
 */
export const PointClickAndRefreshTheme: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lr-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
        @lr-point-click=${(e: CustomEvent) => console.log('lr-point-click', e.detail)}
      ></lr-chart>
      <button
        type="button"
        @click=${(e: Event) => {
          const chart = (e.target as HTMLElement).previousElementSibling as HTMLElement & {
            refreshTheme(): void;
          };
          chart.refreshTheme();
        }}
      >
        refreshTheme()
      </button>
    `;
  },
};

/** Supplying the accessibility-table slot replaces, rather than duplicates, the generated table. */
export const CustomDataTable: Story = {
  render: () => html`
    <lr-chart
      type="bar"
      .labels=${['Q1', 'Q2']}
      .datasets=${[{ label: 'Revenue', data: [12, 19] }]}
    >
      <table slot="data-table">
        <caption>Quarterly revenue</caption>
        <thead><tr><th>Quarter</th><th>Revenue</th></tr></thead>
        <tbody><tr><th>Q1</th><td>12</td></tr><tr><th>Q2</th><td>19</td></tr></tbody>
      </table>
    </lr-chart>
  `,
};
