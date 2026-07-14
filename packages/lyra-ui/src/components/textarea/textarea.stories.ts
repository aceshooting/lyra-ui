import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Textarea',
  component: 'lyra-textarea',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-textarea placeholder="Write something…"></lyra-textarea>`,
};

export const NoResize: Story = {
  render: () => html`<lyra-textarea placeholder="Fixed size" resize="none" rows="4"></lyra-textarea>`,
};

export const Disabled: Story = {
  render: () => html`<lyra-textarea placeholder="Can't type here" disabled></lyra-textarea>`,
};
