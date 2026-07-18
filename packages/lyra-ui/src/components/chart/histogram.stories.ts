import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Charts/Histogram',
  component: 'lr-histogram',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-histogram
      bins="6"
      height="16rem"
      style="width: 22rem"
      .values=${[2, 4, 4, 5, 6, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 15]}
    ></lr-histogram>
  `,
};

/** Narrow-allocation and long-content evidence for histograms embedded in compact panels. */
export const NarrowLongContent: Story = {
  name: 'Narrow (320px) with long content',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-histogram
        aria-label="Distribution of end-to-end request completion times"
        label="Requests grouped by end-to-end completion time"
        bins="6"
        height="16rem"
        legend
        .values=${[2, 4, 4, 5, 6, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 15]}
      ></lr-histogram>
    </div>
  `,
};
