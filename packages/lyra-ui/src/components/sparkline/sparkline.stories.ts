import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const DATA = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];

const meta: Meta = {
  title: 'Sparkline',
  component: 'lyra-sparkline',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Line: Story = {
  render: () => html`<lyra-sparkline type="line" .values=${DATA}></lyra-sparkline>`,
};

export const Area: Story = {
  render: () => html`<lyra-sparkline type="area" .values=${DATA}></lyra-sparkline>`,
};

export const Bar: Story = {
  render: () => html`<lyra-sparkline type="bar" .values=${DATA}></lyra-sparkline>`,
};
