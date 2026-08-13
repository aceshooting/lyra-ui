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

/** Click a legend item to hide its dataset; hidden items retain a line-through state and part hook. */
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

/**
 * `hiddenDatasets` is the complete controlled legend snapshot. The first series' proposal is
 * vetoed below; toggling the second series emits the accepted commit with its next canonical
 * snapshot, which a production host can persist and assign on a later render.
 */
export const ControlledLegendVisibility: Story = {
  render: () => {
    const series: Series[] = [
      { label: 'Revenue (vetoed)', data: [12, 19, 14, 22] },
      { label: 'Costs (initially hidden)', data: [7, 11, 9, 13] },
    ];
    return html`
      <lr-chart
        type="bar"
        height="16rem"
        style="inline-size: 26rem; max-inline-size: 100%;"
        legend
        .hiddenDatasets=${[1]}
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
        @lr-before-legend-visibility-change=${(
          event: CustomEvent<{ datasetIndex: number }>,
        ) => {
          if (event.detail.datasetIndex === 0) event.preventDefault();
        }}
        @lr-legend-visibility-change=${(event: CustomEvent) =>
          console.info('Committed legend visibility', event.detail)}
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
      show-data-table
      .valueFormatter=${(value: number, context: string) =>
        context === 'legend' ? `$${value.toFixed(0)} total` : `$${value.toFixed(2)}`}
      .labels=${['Q1', 'Q2', 'Q3']}
      .datasets=${[{ label: 'Revenue', data: [1200, 1900, 1400] }]}
    ></lr-chart>
  `,
};

/** Narrow-allocation and long-content evidence for charts embedded in panels and dialogs. */
export const NarrowLongContent: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => {
    const series: Series[] = [
      { label: 'Revenue from subscriptions and professional services', data: [12, 19, 14, 22] },
    ];
    return html`
      <div style="inline-size: 320px; max-inline-size: 100%;">
        <lr-chart
          dir="rtl"
          aria-label="Quarterly revenue from subscriptions and professional services"
          type="bar"
          height="16rem"
          legend-position="start"
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

/** The unnamed slot accepts the documented JSON-only Chart.js configuration script. */
export const JsonConfigSlot: Story = {
  name: 'Default JSON config slot',
  render: () => html`
    <lr-chart
      label="Quarterly revenue"
      description="Revenue for the last four quarters"
      without-animation
      style="inline-size: 22rem; max-inline-size: 100%;"
    >
      <script type="application/json">
        {"type":"bar","data":{"labels":["Q1","Q2","Q3","Q4"],"datasets":[{"label":"Revenue","data":[12,19,14,22]}]}}
      </script>
    </lr-chart>
  `,
};

/** The public simplified controls compose without replacing the raw `config` escape hatch. */
export const PublicControls: Story = {
  render: () => html`
    <lr-chart
      label="Revenue by quarter"
      description="Horizontal bars from zero to twenty-five"
      type="bar"
      grid="x"
      index-axis="y"
      legend-position="end"
      min="0"
      max="25"
      stacked
      without-animation
      without-tooltip
      style="inline-size: 22rem; max-inline-size: 100%;"
      .plugins=${[{ id: 'story-plugin' }]}
      .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
      .datasets=${[
        { label: 'Subscriptions', data: [8, 12, 10, 15] },
        { label: 'Services', data: [4, 7, 4, 7] },
      ]}
    ></lr-chart>
  `,
};

/**
 * An explicit `config.data` array is the effective model for every surface: canvas, wrapping
 * legend, generated table, accessible summary, `appendData()`, and CSV export all stay aligned.
 */
export const ConfigDataAsEffectiveModel: Story = {
  render: () => html`
    <lr-chart
      type="bar"
      legend
      show-data-table
      height="16rem"
      style="inline-size: 22rem; max-inline-size: 100%;"
      .labels=${['Ignored simplified label']}
      .datasets=${[{ label: 'Ignored simplified series', data: [0] }]}
      .config=${{
        data: {
          labels: ['Q1', 'Q2', 'Q3'],
          datasets: [{ label: 'Configured revenue', data: [12, 19, 14] }],
        },
      }}
    ></lr-chart>
  `,
};

/** `index-axis="y"` is Chart.js's own `indexAxis: 'y'`, flipping bars onto a horizontal axis. */
export const Horizontal: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lr-chart
        type="bar"
        index-axis="y"
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
        stack-totals
        show-data-table
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
 * The `--lr-chart-grid-color`/`-tick-color`/`-tooltip-bg`/`-tooltip-text`
 * custom properties retheme Chart.js's canvas-drawn chrome. Chart.js can't
 * consume `var()` directly, so those values are resolved via
 * `getComputedStyle` once per draw. `--lr-chart-legend-color` styles the
 * wrapping DOM legend directly; its series swatches use the same computed
 * public series colors as the canvas.
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

/** The public height token remains authoritative; the `height` property only supplies a fallback. */
export const PublicHeightTokenPrecedence: Story = {
  render: () => html`
    <lr-chart
      type="bar"
      height="20rem"
      style="inline-size: 22rem; --lr-chart-height: 12rem;"
      .labels=${['Q1', 'Q2', 'Q3']}
      .datasets=${[{ label: 'Revenue', data: [12, 19, 14] }]}
    ></lr-chart>
  `,
};

/**
 * Hover and press the legend, generated-table values, and reset-zoom button after zooming. Each
 * surface has its own state hooks, so retheming one does not repaint the other two. If the optional
 * zoom peer is unavailable, this remains a usable chart and exposes the documented localized
 * nonfatal feature warning instead of failing the core canvas.
 */
export const IndependentControlStateHooks: Story = {
  render: () => html`
    <lr-chart
      type="bar"
      legend
      zoom
      show-data-table
      height="16rem"
      style="
        inline-size: 22rem;
        --lr-chart-legend-item-hover-bg: var(--lr-color-success-quiet);
        --lr-chart-legend-item-active-bg: var(--lr-color-success);
        --lr-chart-data-table-button-hover-bg: var(--lr-color-warning-quiet);
        --lr-chart-data-table-button-active-bg: var(--lr-color-warning);
        --lr-chart-reset-zoom-button-hover-bg: var(--lr-color-danger-quiet);
        --lr-chart-reset-zoom-button-active-bg: var(--lr-color-danger);
      "
      .labels=${['Q1', 'Q2', 'Q3']}
      .datasets=${[{ label: 'Revenue', data: [12, 19, 14] }]}
    ></lr-chart>
  `,
};

/** Every mirrored geometry/color hook is scoped to one chart and backed by Lyra tokens. */
export const PublicCssHooks: Story = {
  render: () => html`
    <lr-chart
      type="line"
      area
      label="Themeable chart hooks"
      height="16rem"
      style="
        inline-size: 22rem;
        max-inline-size: 100%;
        --border-color-1: var(--lr-color-brand);
        --border-color-2: var(--lr-color-success);
        --border-color-3: var(--lr-color-warning);
        --border-color-4: var(--lr-color-danger);
        --border-color-5: var(--lr-color-text);
        --border-color-6: var(--lr-color-text-quiet);
        --fill-color-1: var(--lr-color-brand-quiet);
        --fill-color-2: var(--lr-color-success-quiet);
        --fill-color-3: var(--lr-color-warning-quiet);
        --fill-color-4: var(--lr-color-danger-quiet);
        --fill-color-5: var(--lr-color-surface-raised);
        --fill-color-6: var(--lr-color-surface);
        --border-radius: var(--lr-radius);
        --border-width: var(--lr-border-width-thin);
        --grid-border-width: var(--lr-border-width-medium);
        --grid-color: var(--lr-color-border);
        --line-border-width: var(--lr-border-width-thick);
        --point-radius: var(--lr-space-xs);
      "
      .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
      .datasets=${[
        { label: 'Revenue', data: [12, 19, 14, 22] },
        { label: 'Costs', data: [7, 11, 9, 13] },
      ]}
    ></lr-chart>
  `,
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

/**
 * Supplying the accessibility-table slot replaces the generated table. It is the application escape
 * hatch for a complete, paginated, or virtualized alternative when the built-in 1,000-record sample
 * is insufficient.
 */
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
