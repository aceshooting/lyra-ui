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
  parameters: { docs: { description: { story: 'appendSamples keeps the newest finite samples in its bounded rolling window. Invalid-heavy batches finish in chunks and queued calls retain append order; assigning values or disconnecting cancels unfinished work.' } } },
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
        series-label="Requests grouped by end-to-end completion time"
        bins="6"
        height="16rem"
        .values=${[2, 4, 4, 5, 6, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 15]}
      ></lr-histogram>
    </div>
  `,
};

/** A host can prepare these exact counts in chunks with prepareLyraHistogram. */
export const PreparedDistribution: Story = {
  parameters: { docs: { description: { story: 'A whole-source distribution retains exact bin counts while reporting below/above-range and invalid observations separately. The plot, accessible table and CSV contain only the displayed bins. Clearing distribution restores the raw values route.' } } },
  render: () => html`
    <lr-histogram with-data-table height="16rem" series-label="Observations"
      .distribution=${{ revision: 'overview', counts: { sourceCount: 1000000, validCount: 999999, invalidCount: 1 }, domain: { min: 0, max: 9 }, edges: [2,5,7], binCounts: [300000,300000], belowCount: 200000, aboveCount: 199999 }}
    ></lr-histogram>
  `,
};
