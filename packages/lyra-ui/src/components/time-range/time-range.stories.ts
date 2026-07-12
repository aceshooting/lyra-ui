import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'TimeRange',
  component: 'lyra-time-range',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
};

export const Disabled: Story = {
  render: () =>
    html`<lyra-time-range min="0" max="100" start="20" end="80" disabled></lyra-time-range>`,
};
