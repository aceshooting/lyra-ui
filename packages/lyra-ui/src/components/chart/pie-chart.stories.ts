import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Pie',
  component: 'lyra-pie-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [
      {
        label: 'Browsers',
        data: [58, 18, 15, 9],
        color: ['#5b8def', '#f7b955', '#59c19a', '#b6b8c3'],
      },
    ];
    return html`
      <lyra-pie-chart
        height="16rem"
        style="width: 16rem"
        .labels=${['Chrome', 'Firefox', 'Safari', 'Other']}
        .datasets=${series}
      ></lyra-pie-chart>
    `;
  },
};
