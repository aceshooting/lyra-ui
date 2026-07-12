import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { TimeRangePreset } from './time-range.js';

const presets: TimeRangePreset[] = [
  { label: 'Last 7 days', start: 0, end: 7 },
  { label: 'Last 30 days', start: 0, end: 30 },
  { label: 'Last 90 days', start: 0, end: 90 },
];

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

export const CoarseStep: Story = {
  render: () =>
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="10"></lyra-time-range>`,
};

export const DiscretePresets: Story = {
  render: () => html`
    <lyra-time-range min="0" max="90" start="0" end="30" .presets=${presets}></lyra-time-range>
  `,
};
