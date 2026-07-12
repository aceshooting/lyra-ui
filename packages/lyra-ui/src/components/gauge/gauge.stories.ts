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
