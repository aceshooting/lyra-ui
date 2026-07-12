import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Heatmap',
  component: 'lyra-heatmap',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-heatmap
      cell-size="24"
      value-label="events"
      .rowLabels=${['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
      .colLabels=${['0h', '6h', '12h', '18h']}
      .values=${[
        [1, 4, 9, 2],
        [0, 2, 6, 3],
        [5, 8, 3, 1],
        [-1, 1, 4, 7],
        [2, 3, 5, 6],
      ]}
    ></lyra-heatmap>
  `,
};
