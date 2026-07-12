import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Line',
  component: 'lyra-line-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [
      { label: 'Sessions', data: [4, 7, 6, 9, 12], fill: true },
      { label: 'Errors', data: [1, 2, 1, 0, 3], color: '#e5484d' },
    ];
    return html`
      <lyra-line-chart
        height="16rem"
        style="width: 22rem"
        legend
        .labels=${['Jan', 'Feb', 'Mar', 'Apr', 'May']}
        .datasets=${series}
      ></lyra-line-chart>
    `;
  },
};
