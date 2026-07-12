import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'FileInput',
  component: 'lyra-file-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-file-input multiple accept=".csv,.xlsx"></lyra-file-input>`,
};
