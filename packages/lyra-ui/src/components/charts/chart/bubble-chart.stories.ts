import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { ChartPoint, Series } from './chart.js';
import { narrowChartStory } from '../../../../../../.storybook/narrow-chart-story.js';

const meta: Meta = {
  title: 'Charts/Bubble',
  component: 'lr-bubble-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const bubblePoints: ChartPoint[] = [
      { x: 10, y: 20, r: 8, label: 'North cluster' },
      { x: 15, y: 10, r: 12, label: 'Central cluster' },
      { x: 20, y: 30, r: 6, label: 'South cluster' },
    ];
    const series: Series[] = [
      { label: 'Clusters', points: bubblePoints },
    ];
    return html`
      <lr-bubble-chart
        height="16rem"
        style="width: 22rem"
        .datasets=${series}
      ></lr-bubble-chart>
    `;
  },
};

/** Narrow-allocation, RTL, and long-content evidence for the concrete bubble controller. */
export const NarrowLongContent: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => {
    const bubblePoints: ChartPoint[] = [
      { x: 10, y: 20, r: 8, label: 'Northern production cluster' },
      { x: 15, y: 10, r: 12, label: 'Central production cluster' },
      { x: 20, y: 30, r: 6, label: 'Southern production cluster' },
    ];
    const series: Series[] = [{ label: 'Capacity by production deployment cluster', points: bubblePoints }];
    return narrowChartStory(html`
      <lr-bubble-chart
        aria-label="Capacity by production deployment cluster"
        height="16rem"
        legend
        legend-position="start"
        .datasets=${series}
      ></lr-bubble-chart>
    `);
  },
};
