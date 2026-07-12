import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Chart',
  component: 'lyra-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lyra-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        legend
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lyra-chart>
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
      <lyra-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
        .config=${{
          options: { plugins: { title: { display: true, text: 'Quarterly revenue' } } },
        }}
      ></lyra-chart>
    `;
  },
};

/** `horizontal` sets Chart.js's `indexAxis: 'y'`, flipping bars onto a horizontal axis. */
export const Horizontal: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lyra-chart
        type="bar"
        horizontal
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lyra-chart>
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
      <lyra-chart
        type="bar"
        stacked
        legend
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lyra-chart>
    `;
  },
};

/**
 * The `--lyra-chart-grid-color`/`-tick-color`/`-legend-color`/`-tooltip-bg`/
 * `-tooltip-text` custom properties retheme Chart.js's canvas-drawn chrome
 * (grid lines, axis ticks/titles, legend labels, tooltip). Chart.js can't
 * consume `var()` directly, so these are resolved via `getComputedStyle`
 * once per draw — see `themeColors()` in `chart.ts`.
 */
export const ThemedTokens: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lyra-chart
        type="bar"
        legend
        height="16rem"
        style="
          width: 22rem;
          --lyra-chart-grid-color: #e5484d;
          --lyra-chart-tick-color: #e5484d;
          --lyra-chart-legend-color: #e5484d;
          --lyra-chart-tooltip-bg: #1a1a1a;
          --lyra-chart-tooltip-text: #fff;
        "
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lyra-chart>
    `;
  },
};

/**
 * `lyra-point-click` fires whenever a click lands on (or nearest,
 * intersect-only) a data point/segment — covers any `type`, not just bars.
 * `refreshTheme()` forces a redraw so an out-of-band theme change (e.g. a
 * host-level dark-mode toggle that doesn't touch any `lyra-chart` property)
 * is picked up immediately, rather than waiting for the next reactive update.
 */
export const PointClickAndRefreshTheme: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lyra-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
        @lyra-point-click=${(e: CustomEvent) => console.log('lyra-point-click', e.detail)}
      ></lyra-chart>
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
