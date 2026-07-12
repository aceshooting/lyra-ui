import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Flag',
  component: 'lyra-flag',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lyra-flag country="fr" label="France" style="height: 1.5rem"></lyra-flag>
      <lyra-flag language="en" label="English" style="height: 1.5rem"></lyra-flag>
      <lyra-flag language="de" label="German" round style="height: 1.5rem"></lyra-flag>
      <lyra-flag country="jp" label="Japan" round style="height: 1.5rem"></lyra-flag>
    </div>
  `,
};
