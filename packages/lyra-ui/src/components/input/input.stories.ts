import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './input.js';

const meta: Meta = {
  title: 'Input',
  component: 'lyra-input',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A single-line plain-text input primitive -- the `lyra-*` equivalent of a plain `wa-input`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lyra-input label="Name" placeholder="Ada Lovelace"></lyra-input>`,
};

export const Password: Story = {
  render: () => html`<lyra-input type="password" label="Password"></lyra-input>`,
};

export const Email: Story = {
  render: () => html`<lyra-input type="email" label="Email" required></lyra-input>`,
};

export const NumericType: Story = {
  name: 'type="number"',
  render: () => html`<lyra-input type="number" label="Quantity" min="1" max="10" step="1" value="1"></lyra-input>`,
};

export const ValidationMessage: Story = {
  render: () => html`<lyra-input type="email" label="Email" hint="We'll never share it." required></lyra-input>`,
};

export const CompactGridRow: Story = {
  name: 'Compact grid row (aria-label only)',
  render: () => html`<lyra-input aria-label="Search" placeholder="Search..."></lyra-input>`,
};

export const Disabled: Story = {
  render: () => html`<lyra-input label="Name" value="Ada Lovelace" disabled></lyra-input>`,
};
