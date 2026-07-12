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
