import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { Series } from './chart.js';

interface BubblePoint {
  x: number;
  y: number;
  r: number;
}

const meta: Meta = {
  title: 'Charts/Bubble',
  component: 'lyra-bubble-chart',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const bubblePoints: BubblePoint[] = [
      { x: 10, y: 20, r: 8 },
      { x: 15, y: 10, r: 12 },
      { x: 20, y: 30, r: 6 },
    ];
    const series: Series[] = [
      { label: 'Clusters', points: bubblePoints as unknown as Series['points'] },
    ];
    return html`
      <lyra-bubble-chart
        height="16rem"
        style="width: 22rem"
        .datasets=${series}
      ></lyra-bubble-chart>
    `;
  },
};
