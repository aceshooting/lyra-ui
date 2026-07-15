import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LiteSeries } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/LiteChart',
  component: 'lyra-lite-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

/** Zero-dependency alternative to `lyra-chart` — plain SVG/DOM, no `chart.js` peer dep. */
export const Default: Story = {
  render: () => {
    const series: LiteSeries[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lyra-lite-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        legend
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lyra-lite-chart>
    `;
  },
};

/** Narrow-allocation and long-content evidence for the dependency-free chart. */
export const NarrowLongContent: Story = {
  name: 'Narrow (320px) with long content',
  render: () => {
    const series: LiteSeries[] = [
      { label: 'Revenue from subscriptions and professional services', data: [12, 19, 14, 22] },
    ];
    return html`
      <div style="inline-size: 320px; max-inline-size: 100%;">
        <lyra-lite-chart
          aria-label="Quarterly revenue from subscriptions and professional services"
          type="bar"
          height="16rem"
          legend
          max-labels="4"
          .labels=${['First quarter', 'Second quarter', 'Third quarter', 'Fourth quarter']}
          .datasets=${series}
        ></lyra-lite-chart>
      </div>
    `;
  },
};

export const GroupedBars: Story = {
  render: () => {
    const series: LiteSeries[] = [
      { label: 'This year', data: [12, 19, 14, 22] },
      { label: 'Last year', data: [9, 15, 11, 18] },
    ];
    return html`
      <lyra-lite-chart
        type="bar"
        height="16rem"
        style="width: 24rem"
        legend
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lyra-lite-chart>
    `;
  },
};

/** `stacked` sums each category's bars into one segmented bar instead of grouping them side by side. */
export const StackedBars: Story = {
  render: () => {
    const series: LiteSeries[] = [
      { label: 'Docs', data: [4, 6, 3, 8] },
      { label: 'Bugs', data: [3, 2, 5, 4] },
      { label: 'Features', data: [5, 7, 6, 3] },
    ];
    return html`
      <lyra-lite-chart
        type="bar"
        stacked
        height="16rem"
        style="width: 24rem"
        legend
        x-label="Week"
        y-label="Commits"
        .labels=${['W1', 'W2', 'W3', 'W4']}
        .datasets=${series}
      ></lyra-lite-chart>
    `;
  },
};

export const Line: Story = {
  render: () => {
    const series: LiteSeries[] = [
      { label: 'CPU', data: [20, 35, 42, 30, 55] },
      { label: 'Memory', data: [40, 38, 45, 60, 58] },
    ];
    return html`
      <lyra-lite-chart
        type="line"
        height="16rem"
        style="width: 24rem"
        legend
        .labels=${['00:00', '00:05', '00:10', '00:15', '00:20']}
        .datasets=${series}
      ></lyra-lite-chart>
    `;
  },
};

/** Clicking (or Enter/Space on a focused) bar/point fires `lyra-point-click`, same detail shape as `lyra-chart`'s. */
export const ClickToFilter: Story = {
  render: () => {
    const series: LiteSeries[] = [{ label: 'Runs', data: [12, 19, 14, 22] }];
    return html`
      <lyra-lite-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
        @lyra-point-click=${(e: CustomEvent) => alert(JSON.stringify(e.detail))}
      ></lyra-lite-chart>
    `;
  },
};

/** `tickFormat` customizes y-axis tick labels (e.g. currency) instead of the built-in nice-number formatter. */
export const CurrencyTickFormat: Story = {
  render: () => {
    const series: LiteSeries[] = [{ label: 'Revenue', data: [1204.37, 1890.5, 1420.1, 2260.75] }];
    return html`
      <lyra-lite-chart
        type="bar"
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
        .tickFormat=${(v: number) => `$${v.toFixed(2)}`}
      ></lyra-lite-chart>
    `;
  },
};

/** `layout="scroll"` gives every bar a fixed `bar-width` instead of squeezing them into the host
 *  width -- with a long category list the plot overflows the (deliberately narrow) host, which
 *  scrolls horizontally to reveal the rest, instead of cramming 40 skinny bars into one view. */
export const ScrollLayout: Story = {
  render: () => {
    const labels = Array.from({ length: 40 }, (_, i) => `Day ${i + 1}`);
    const series: LiteSeries[] = [{ label: 'Signups', data: labels.map((_, i) => 10 + ((i * 7) % 40)) }];
    return html`
      <lyra-lite-chart
        type="bar"
        layout="scroll"
        bar-width="28"
        height="16rem"
        style="width: 24rem"
        x-label="Day"
        y-label="Signups"
        .labels=${labels}
        .datasets=${series}
      ></lyra-lite-chart>
    `;
  },
};

/** `maxLabels` thins out which x-axis category labels render text (bars themselves always still
 *  render) once there are more categories than that -- always keeping the first and last label,
 *  spreading the rest roughly evenly, so a long category list stays legible in `layout="fit"`
 *  instead of the axis text overlapping into an unreadable smear. */
export const LabelDecimation: Story = {
  render: () => {
    const labels = Array.from({ length: 24 }, (_, i) => `Week ${i + 1}`);
    const series: LiteSeries[] = [{ label: 'Throughput', data: labels.map((_, i) => 20 + ((i * 11) % 30)) }];
    return html`
      <lyra-lite-chart
        type="bar"
        max-labels="6"
        height="16rem"
        style="width: 26rem"
        x-label="Week"
        y-label="Throughput"
        .labels=${labels}
        .datasets=${series}
      ></lyra-lite-chart>
    `;
  },
};
