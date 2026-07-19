import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './input.js';

const meta: Meta = {
  title: 'Input',
  component: 'lr-input',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A single-line plain-text input primitive -- the `lr-*` equivalent of a plain `wa-input`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-input label="Name" placeholder="Ada Lovelace"></lr-input>`,
};

export const Password: Story = {
  render: () => html`<lr-input type="password" label="Password"></lr-input>`,
};

export const Email: Story = {
  render: () => html`<lr-input type="email" label="Email" required></lr-input>`,
};

export const NumericType: Story = {
  name: 'type="number"',
  render: () => html`<lr-input type="number" label="Quantity" min="1" max="10" step="1" value="1"></lr-input>`,
};

export const ValidationMessage: Story = {
  render: () => html`<lr-input type="email" label="Email" hint="We'll never share it." required></lr-input>`,
};

export const CompactGridRow: Story = {
  name: 'Compact grid row (aria-label only)',
  render: () => html`<lr-input aria-label="Search" placeholder="Search..."></lr-input>`,
};

export const ClearableWithAdornments: Story = {
  render: () => html`
    <lr-input type="search" clearable value="workflow" aria-label="Search workflows">
      <span slot="start" aria-hidden="true">⌕</span>
      <kbd slot="end">⌘K</kbd>
    </lr-input>
  `,
};

export const Disabled: Story = {
  render: () => html`<lr-input label="Name" value="Ada Lovelace" disabled></lr-input>`,
};
