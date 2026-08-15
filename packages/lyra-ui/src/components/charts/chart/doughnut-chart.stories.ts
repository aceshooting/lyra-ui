import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraChartSeries } from './chart.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';
import { narrowChartStory } from '../../../../../../.storybook/narrow-chart-story.js';

const meta: Meta = {
  title: 'Charts/Doughnut',
  component: 'lr-doughnut-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: LyraChartSeries[] = [
      {
        label: 'Browsers',
        data: [58, 18, 15, 9],
        color: [storyColor('chart1'), storyColor('chart2'), storyColor('chart3'), storyColor('chart4')],
      },
    ];
    return html`
      <lr-doughnut-chart
        height="16rem"
        style="width: 16rem"
        .labels=${['Chrome', 'Firefox', 'Safari', 'Other']}
        .datasets=${series}
      ></lr-doughnut-chart>
    `;
  },
};

/** Narrow-allocation, RTL, and long-content evidence for the concrete doughnut controller. */
export const NarrowLongContent: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => {
    const series: LyraChartSeries[] = [
      {
        label: 'Browser sessions across supported client environments',
        data: [58, 18, 15, 9],
        color: [storyColor('chart1'), storyColor('chart2'), storyColor('chart3'), storyColor('chart4')],
      },
    ];
    return narrowChartStory(html`
      <lr-doughnut-chart
        aria-label="Browser sessions across supported client environments"
        height="16rem"
        legend-position="start"
        .labels=${['Chromium-based browsers', 'Mozilla Firefox', 'Apple Safari', 'Other browsers']}
        .datasets=${series}
      ></lr-doughnut-chart>
    `);
  },
};
