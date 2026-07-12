import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from './chart.js';

const meta: Meta = {
  title: 'Charts/Radar',
  component: 'lyra-radar-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Model A', data: [80, 90, 70, 85, 75] }];
    return html`
      <lyra-radar-chart
        height="16rem"
        style="width: 22rem"
        .labels=${['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency']}
        .datasets=${series}
      ></lyra-radar-chart>
    `;
  },
};
