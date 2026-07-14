import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Gauge',
  component: 'lyra-gauge',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Radial: Story = {
  render: () => html`<lyra-gauge value="72" max="100" label="CPU"></lyra-gauge>`,
};

export const Linear: Story = {
  render: () => html`<lyra-gauge type="linear" value="40" max="100" label="Disk"></lyra-gauge>`,
};

export const Ring: Story = {
  render: () => html`
    <div style="display: flex; gap: 2rem; align-items: center; flex-wrap: wrap">
      <lyra-gauge type="ring" value="72" max="100" label="Score"></lyra-gauge>
      <lyra-gauge
        type="ring"
        value="84"
        max="100"
        label="Coverage"
        style="--lyra-gauge-fill: var(--lyra-color-success)"
      ></lyra-gauge>
    </div>
  `,
};

export const WithValueLabel: Story = {
  render: () => html`<lyra-gauge value="72" max="100" label="Temp" .valueLabel=${'72°F'}></lyra-gauge>`,
};

export const NonzeroMin: Story = {
  render: () => html`<lyra-gauge value="18" min="-20" max="40" label="Outdoor Temp"></lyra-gauge>`,
};
