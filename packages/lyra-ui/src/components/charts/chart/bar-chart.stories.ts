import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from './chart.js';
import { narrowChartStory } from '../../../../../../.storybook/narrow-chart-story.js';

const meta: Meta = {
  title: 'Charts/Bar',
  component: 'lr-bar-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lr-bar-chart
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lr-bar-chart>
    `;
  },
};

/** Narrow-allocation, RTL, and long-content evidence for the concrete bar controller. */
export const NarrowLongContent: Story = {
  name: 'Narrow RTL (320px) with long content',
  render: () => {
    const series: Series[] = [
      { label: 'Revenue from subscriptions and professional services', data: [12, 19, 14, 22] },
    ];
    return narrowChartStory(html`
      <lr-bar-chart
        aria-label="Quarterly revenue from subscriptions and professional services"
        height="16rem"
        legend
        legend-position="start"
        .labels=${['First quarter', 'Second quarter', 'Third quarter', 'Fourth quarter']}
        .datasets=${series}
      ></lr-bar-chart>
    `);
  },
};
