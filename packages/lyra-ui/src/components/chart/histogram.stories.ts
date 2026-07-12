import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Charts/Histogram',
  component: 'lyra-histogram',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-histogram
      bins="6"
      height="16rem"
      style="width: 22rem"
      .values=${[2, 4, 4, 5, 6, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 15]}
    ></lyra-histogram>
  `,
};
