import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraChartSeries } from './chart.js';
import { narrowChartStory } from '../../../../../../.storybook/narrow-chart-story.js';

const meta: Meta = {
  title: 'Charts/Scatter',
  component: 'lr-scatter-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: LyraChartSeries[] = [
      {
        label: 'Samples',
        points: [
          { x: 10, y: 20 },
          { x: 15, y: 10 },
          { x: 20, y: 30 },
          { x: 25, y: 15 },
        ],
      },
    ];
    return html`
      <lr-scatter-chart
        height="16rem"
        style="width: 22rem"
        x-label="X value"
        y-label="Y value"
        .datasets=${series}
      ></lr-scatter-chart>
    `;
  },
};

/** Narrow-allocation, RTL, and long-content evidence for the concrete scatter controller. */
export const NarrowLongContent: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => {
    const series: LyraChartSeries[] = [
      {
        label: 'Request duration samples across production deployment cohorts',
        points: [
          { x: 10, y: 20 },
          { x: 15, y: 10 },
          { x: 20, y: 30 },
          { x: 25, y: 15 },
        ],
      },
    ];
    return narrowChartStory(html`
      <lr-scatter-chart
        aria-label="Request duration samples across production deployment cohorts"
        height="16rem"
        legend-position="start"
        x-label="End-to-end request duration"
        y-label="Completed requests"
        .datasets=${series}
      ></lr-scatter-chart>
    `);
  },
};
