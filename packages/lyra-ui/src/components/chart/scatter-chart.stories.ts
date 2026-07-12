import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from './chart.js';

const meta: Meta = {
  title: 'Charts/Scatter',
  component: 'lyra-scatter-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [
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
      <lyra-scatter-chart
        height="16rem"
        style="width: 22rem"
        x-label="X"
        y-label="Y"
        .datasets=${series}
      ></lyra-scatter-chart>
    `;
  },
};
