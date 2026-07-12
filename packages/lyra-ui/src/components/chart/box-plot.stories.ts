import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { BoxPlotSeries } from '../../lyra.js';

const meta: Meta = {
  title: 'Charts/BoxPlot',
  component: 'lyra-box-plot',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const boxes: BoxPlotSeries[] = [
      {
        label: 'Loss',
        data: [
          { min: 1, q1: 2, median: 3, q3: 4, max: 5 },
          { min: 2, q1: 3, median: 4, q3: 5, max: 6 },
          { min: 1.5, q1: 2.5, median: 3.5, q3: 4.5, max: 6.5 },
        ],
      },
    ];
    return html`
      <lyra-box-plot
        height="16rem"
        style="width: 22rem"
        .labels=${['K=2', 'K=3', 'K=4']}
        .boxes=${boxes}
      ></lyra-box-plot>
    `;
  },
};
