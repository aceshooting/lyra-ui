import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/Bar',
  component: 'lyra-bar-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const series: Series[] = [{ label: 'Revenue', data: [12, 19, 14, 22] }];
    return html`
      <lyra-bar-chart
        height="16rem"
        style="width: 22rem"
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${series}
      ></lyra-bar-chart>
    `;
  },
};
