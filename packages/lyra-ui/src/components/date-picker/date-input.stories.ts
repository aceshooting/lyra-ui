import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'DatePicker/WithInput',
  component: 'lyra-date-input',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-date-input label="Start date" with-clear style="max-width: 16rem"></lyra-date-input>
  `,
};
