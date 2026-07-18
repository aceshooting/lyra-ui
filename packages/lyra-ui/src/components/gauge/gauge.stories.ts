import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Gauge',
  component: 'lr-gauge',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Radial: Story = {
  render: () => html`<lr-gauge value="72" max="100" label="CPU"></lr-gauge>`,
};

export const Linear: Story = {
  render: () => html`<lr-gauge type="linear" value="40" max="100" label="Disk"></lr-gauge>`,
};

export const Ring: Story = {
  render: () => html`
    <div style="display: flex; gap: 2rem; align-items: center; flex-wrap: wrap">
      <lr-gauge type="ring" value="72" max="100" label="Score"></lr-gauge>
      <lr-gauge
        type="ring"
        value="84"
        max="100"
        label="Coverage"
        style="--lr-gauge-fill: var(--lr-color-success)"
      ></lr-gauge>
    </div>
  `,
};

export const WithValueLabel: Story = {
  render: () => html`<lr-gauge value="72" max="100" label="Temp" .valueLabel=${'72°F'}></lr-gauge>`,
};

export const NonzeroMin: Story = {
  render: () => html`<lr-gauge value="18" min="-20" max="40" label="Outdoor Temp"></lr-gauge>`,
};
