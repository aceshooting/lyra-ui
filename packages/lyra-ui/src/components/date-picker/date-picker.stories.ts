import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'DatePicker/Inline',
  component: 'lyra-date-picker',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Single: Story = {
  render: () => html`<lyra-date-picker mode="single"></lyra-date-picker>`,
};

export const Range: Story = {
  render: () => html`<lyra-date-picker mode="range" months="2"></lyra-date-picker>`,
};
