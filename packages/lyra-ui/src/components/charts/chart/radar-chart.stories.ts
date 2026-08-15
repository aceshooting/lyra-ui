import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraChartSeries } from './chart.js';
import { narrowChartStory } from '../../../../../../.storybook/narrow-chart-story.js';

const meta: Meta = {
  title: 'Charts/Radar',
  component: 'lr-radar-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: LyraChartSeries[] = [{ label: 'Model A', data: [80, 90, 70, 85, 75] }];
    return html`
      <lr-radar-chart
        height="16rem"
        style="width: 22rem"
        .labels=${['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency']}
        .datasets=${series}
      ></lr-radar-chart>
    `;
  },
};

/** Narrow-allocation, RTL, and long-content evidence for the concrete radar controller. */
export const NarrowLongContent: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => {
    const series: LyraChartSeries[] = [
      { label: 'Production model evaluation across all quality dimensions', data: [80, 90, 70, 85, 75] },
    ];
    return narrowChartStory(html`
      <lr-radar-chart
        aria-label="Production model evaluation across all quality dimensions"
        height="16rem"
        legend-position="start"
        .labels=${[
          'Response speed',
          'Operational reliability',
          'User comfort',
          'Safety compliance',
          'Resource efficiency',
        ]}
        .datasets=${series}
      ></lr-radar-chart>
    `);
  },
};
